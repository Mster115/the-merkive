#!/usr/bin/env node
/**
 * Daily-content pipeline CLI.
 *
 * The admin API has three sharp edges that prose in a runbook does not stop
 * anyone walking into:
 *
 *   1. `submit-pack` upserts on (game_id, puzzle_date). Re-submitting a date
 *      silently REPLACES that puzzle, with no warning and no version history.
 *   2. `queue-status` returns a COUNT of filled future days, not which dates.
 *      So "the next free date" has to be derived, and getting the arithmetic
 *      off by one either overwrites tomorrow or leaves a hole in the queue.
 *   3. Drafts awaiting review are not counted by `queue-status` at all, so the
 *      count alone will happily point you at a date that already has a pack
 *      sitting in the review queue.
 *
 * Every one of those is checked here rather than left to whoever is driving.
 * Submitting requires an explicit --yes, and writing over an existing date
 * requires --force.
 *
 * Usage:
 *   node scripts/daily-content.mjs secret                       # is it configured?
 *   node scripts/daily-content.mjs status
 *   node scripts/daily-content.mjs plan [--lookahead 5]
 *   node scripts/daily-content.mjs prompt <gameId> <YYYY-MM-DD>
 *   node scripts/daily-content.mjs verify <pack.json>...        # offline
 *   node scripts/daily-content.mjs submit <pack.json>... --yes [--force]
 *   node scripts/daily-content.mjs review [--full]
 *   node scripts/daily-content.mjs decide <id> --approve|--reject
 *
 * The pipeline secret is resolved by scripts/secret.mjs — macOS Keychain by
 * default, so it lives in exactly one place and never in a config file, a shell
 * history line, or this repo. See `resolveSecret` for the full order.
 *
 * Env:
 *   MERKY_BASE_URL         default https://the-merkive.vercel.app
 */

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import process from "node:process";

import { requireSecret, resolveSecret, SETUP_HINT, KEYCHAIN_SERVICE } from "./secret.mjs";

const BASE_URL = (process.env.MERKY_BASE_URL ?? "https://the-merkive.vercel.app").replace(/\/$/, "");
const GAMES = ["nexus", "nutshell", "relay", "waypoint", "detour", "chipshot"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- date helpers -----------------------------------------------------------

/**
 * The pipeline's "today" — the current puzzle date, i.e. the calendar date in
 * America/New_York. The daily games flip once, globally, at midnight US
 * Eastern, and the server's `getQueueStatus` runs on the same basis
 * (`currentPuzzleDate` in apps/web/src/server/daily/timezone.ts). The two must
 * agree: a different basis here would drift by one for part of every day and
 * silently shift every target.
 */
export function currentPuzzleDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The first date safe to write, given how many future days are already queued.
 *
 * Fallback only. The API now reports `openDates` directly, which is exact and
 * accounts for gaps and pending drafts; this derivation assumes the queue is
 * contiguous from today and is kept for older deployments that do not send
 * them. `queuedFutureDays` counts dates >= today, so a contiguous queue occupies
 * today .. today+(n-1) and the first free date is today+n — NOT today+n+1,
 * which would leave a hole. Floored at tomorrow, because today's puzzle is
 * live and must never be rewritten.
 */
export function firstFreeDate(queuedFutureDays, today = currentPuzzleDate()) {
  const derived = addDays(today, Math.max(queuedFutureDays, 0));
  const tomorrow = addDays(today, 1);
  return derived > tomorrow ? derived : tomorrow;
}

/**
 * Whether the queue is deep enough to survive the daily flip.
 *
 * The games flip globally at midnight US Eastern. With only today queued
 * (queuedFutureDays === 1), every player worldwide hits `no_puzzle_today` at
 * the same instant the clock strikes twelve in New York; at 0, they already
 * have. One spare day is the floor, not a nicety — it is what makes a single
 * missed routine run a non-event.
 */
export function queueRisk(queuedFutureDays) {
  if (queuedFutureDays <= 0) {
    return "EMPTY — no puzzle is queued for today; every device 404s";
  }
  if (queuedFutureDays === 1) {
    return "only today is queued — at midnight US Eastern every player sees no puzzle";
  }
  return null;
}

export function planDates(queuedFutureDays, lookahead, today = currentPuzzleDate(), maxPerRun = 3) {
  const dates = [];
  let cursor = firstFreeDate(queuedFutureDays, today);
  while (queuedFutureDays + dates.length < lookahead && dates.length < maxPerRun) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/**
 * Slot-length histograms for every Nutshell layout, read from the game's own
 * `PATTERN_LIBRARY`.
 *
 * Derived rather than restated: a hardcoded copy of one layout's distribution
 * is exactly what made preflight reject the corner grids `daily_grid` serves.
 * Returns [] if the file cannot be read, which downgrades the check to "skip"
 * rather than blocking a submission the server would accept.
 */
function patternLengthHistograms() {
  let src;
  try {
    src = readFileSync(
      new URL("../packages/games/src/daily/nutshell/patterns.ts", import.meta.url),
      "utf8"
    );
  } catch {
    return [];
  }

  const layouts = [];
  const re = /id:\s*"([a-z0-9_]+)",\s*gridPattern:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(src))) {
    const rows = [...m[2].matchAll(/"([.#]{5})"/g)].map((r) => r[1]);
    if (rows.length !== 5) continue;

    const need = {};
    const count = (len) => {
      if (len >= 3) need[len] = (need[len] ?? 0) + 1;
    };
    for (let r = 0; r < 5; r++) {
      let run = 0;
      for (let c = 0; c <= 5; c++) {
        if (c < 5 && rows[r][c] !== "#") run++;
        else {
          count(run);
          run = 0;
        }
      }
    }
    for (let c = 0; c < 5; c++) {
      let run = 0;
      for (let r = 0; r <= 5; r++) {
        if (r < 5 && rows[r][c] !== "#") run++;
        else {
          count(run);
          run = 0;
        }
      }
    }
    layouts.push({ id: m[1], need });
  }
  return layouts;
}

// --- api --------------------------------------------------------------------

async function api(path, init = {}) {
  let secret;
  try {
    secret = requireSecret();
  } catch (e) {
    fail(String(e.message));
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail = typeof body === "object" && body ? JSON.stringify(body) : String(body);
    if (res.status === 401) {
      fail(`Unauthorized (401) from ${path}. The pipeline secret is wrong.\n\n${SETUP_HINT}`);
    }
    throw new Error(`${res.status} ${path}: ${detail}`);
  }
  return body;
}

// --- offline preflight ------------------------------------------------------

/**
 * Cheap local checks that mirror the server validators.
 *
 * Advisory only — the server's `validatePack` is authoritative, and a rejected
 * submission stores nothing. The point is to catch the routine failures (wrong
 * cell count, missing citations, a word bank with no chain) before spending a
 * round trip, and to surface things the validator accepts but a human would
 * not want, like a Relay bank containing an unintended shortcut.
 */
export function preflight(pack) {
  const problems = [];
  const warnings = [];

  if (!pack || typeof pack !== "object") return { problems: ["pack is not an object"], warnings };
  if (!GAMES.includes(pack.gameId)) problems.push(`unknown gameId: ${pack.gameId}`);
  if (!DATE_RE.test(pack.puzzleDate ?? "")) problems.push(`puzzleDate must be YYYY-MM-DD`);

  const payload = pack.payload ?? {};
  const sourceRefs = Array.isArray(pack.sourceRefs) ? pack.sourceRefs : [];

  if (pack.gameId === "nexus") {
    if (sourceRefs.length === 0) problems.push("nexus requires at least one sourceRef");
    for (const ref of sourceRefs) {
      if (!ref?.url || !ref?.title) problems.push("each sourceRef needs both url and title");
    }
    for (const key of ["rowLabels", "colLabels"]) {
      const labels = payload[key];
      if (!Array.isArray(labels) || labels.length !== 3 || labels.some((l) => !String(l ?? "").trim())) {
        problems.push(`${key} must be 3 non-empty strings`);
      }
    }
    const cells = Array.isArray(payload.cells) ? payload.cells : [];
    if (cells.length !== 9) problems.push(`cells must contain exactly 9 entries (got ${cells.length})`);
    const seen = new Set();
    for (const c of cells) {
      const key = `${c?.row}:${c?.col}`;
      if (![0, 1, 2].includes(c?.row) || ![0, 1, 2].includes(c?.col)) problems.push(`bad coordinates (${key})`);
      else if (seen.has(key)) problems.push(`duplicate coordinate (${key})`);
      seen.add(key);
      if (!String(c?.question ?? "").trim()) problems.push(`cell ${key} has an empty question`);
      if (!String(c?.answer ?? "").trim()) problems.push(`cell ${key} has an empty answer`);
      if (!Array.isArray(c?.acceptableAnswers) || c.acceptableAnswers.length === 0) {
        warnings.push(
          `cell ${key} lists no acceptableAnswers — retries cost points, so a player who says it another way still loses`
        );
      }
      // A hint costs the player a scoring step, so one that names its own
      // answer charges them for something they already had. validatePack
      // rejects this outright; flag it here while it is still cheap to fix.
      if (c?.hint !== undefined && c?.hint !== null && String(c.hint).trim() !== "") {
        const hint = String(c.hint).trim();
        if (hint.length > 120) {
          problems.push(`cell ${key} hint is longer than 120 characters`);
        }
        const answer = String(c?.answer ?? "").trim().toLowerCase();
        if (answer.length >= 3 && hint.toLowerCase().includes(answer)) {
          problems.push(`cell ${key} hint contains the answer it is hinting at — "${c.answer}"`);
        }
      }
    }

    const hinted = cells.filter(
      (c) => c?.hint !== undefined && c?.hint !== null && String(c.hint).trim() !== ""
    ).length;
    if (hinted === 0) {
      warnings.push(
        "no cell ships an authored hint — players report Nexus as the hardest daily game, so the harder cells should carry one"
      );
    }

    // Questions are broadcast in publicState from the first render, so a
    // question containing another cell's answer hands that cell away for free.
    // Easy to do by accident: "named after the Titans" gives away TITAN, and
    // "when a volcano's magma reservoir collapses" gives away MAGMA.
    // Hints are held server-side until bought, so they leak later than a
    // question does rather than never — same check, same reason.
    for (const q of cells) {
      for (const [field, text] of [
        ["question", String(q?.question ?? "").toLowerCase()],
        ["hint", String(q?.hint ?? "").toLowerCase()],
      ]) {
        if (!text) continue;
        for (const a of cells) {
          if (a === q) continue;
          const answer = String(a?.answer ?? "").trim().toLowerCase();
          if (answer.length >= 4 && text.includes(answer)) {
            problems.push(
              `cell (${q.row},${q.col}) ${field} contains the answer to cell (${a.row},${a.col}) — "${a.answer}"`
            );
          }
        }
      }
    }

    // A question must not identify its own answer. Reported live on
    // 2026-07-31: "Which 2024 Summer Games became the first in Olympic history
    // to field an equal number of male and female athletes?" — there is exactly
    // one 2024 Summer Games, so nothing is left to recall and the player is
    // reduced to guessing which label the key happens to use. The same grid
    // asked "Which Japanese breaker, competing as B-Girl Ami, won…" for an
    // answer of Ami Yuasa. The player's words: "I would never have guessed
    // that's what they were looking for."
    const SELF_LEAK_STOPWORDS = new Set([
      "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "by",
      "with", "from", "de", "la", "le", "el", "von", "van", "der", "den", "st",
      "mount", "lake", "new", "north", "south", "east", "west", "city", "united",
      "national", "international", "world", "great", "grand", "royal",
    ]);
    for (const c of cells) {
      const question = String(c?.question ?? "").toLowerCase();
      const answer = String(c?.answer ?? "").trim();
      if (!question || !answer) continue;

      const tokens = answer
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !SELF_LEAK_STOPWORDS.has(t));

      for (const token of tokens) {
        // Whole-word only: "art" must not fire on "Bartholomew", and a year in
        // the answer ("Paris 2024") only counts if the question says it too.
        if (new RegExp(`\\b${token}\\b`, "u").test(question)) {
          problems.push(
            `cell (${c.row},${c.col}) question contains "${token}" from its own answer "${answer}" — ` +
              `the question identifies what it is asking for, leaving the player to guess the wording rather than the fact`
          );
          break;
        }
      }
    }

    // Event and edition names have several equally natural surface forms —
    // "Paris 2024", "Paris", "the 2024 Summer Olympics" — and the grader only
    // knows the ones the pack lists. A player who knows the fact and picks a
    // different form is marked wrong for the format, not the knowledge.
    for (const c of cells) {
      const answer = String(c?.answer ?? "").trim();
      const variants = Array.isArray(c?.acceptableAnswers) ? c.acceptableAnswers.length : 0;
      const looksLikeAnEdition =
        /\b(1[89]|20)\d{2}\b/.test(answer) && answer.split(/\s+/).filter(Boolean).length >= 2;
      if (looksLikeAnEdition && variants < 2) {
        warnings.push(
          `cell (${c.row},${c.col}) answers "${answer}", which a player could reasonably write several ways — ` +
            `list the bare name and the other common forms in acceptableAnswers`
        );
      }
    }

    // A question about one entry in a series has to say *which* entry. The
    // grader will never accept the franchise name for one of its films — doing
    // so would accept it for the other films too — so an under-specified
    // question marks a player wrong for an answer they had good reason to give.
    // Reported live: "Lord of the Rings" for a key of "The Return of the King".
    for (const c of cells) {
      const question = String(c?.question ?? "");
      const answer = String(c?.answer ?? "").trim();
      // Only title-shaped answers: a multi-word name is what a franchise can
      // stand in for. A one-word answer has no broader form to confuse it with.
      if (answer.split(/\s+/).filter(Boolean).length < 2) continue;
      const q = question.toLowerCase();
      const looksSerial =
        /^the\s/i.test(answer) ||
        /\b(film|movie|album|book|novel|sequel|episode|season|series|instal?ment|volume)\b/.test(q);
      if (!looksSerial) continue;
      const isPinned =
        /\b(1[89]|20)\d{2}\b/.test(q) ||
        /\b\d+(st|nd|rd|th)\b/.test(q) ||
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|final|last|debut|original|latest)\b/.test(
          q
        );
      if (!isPinned) {
        warnings.push(
          `cell (${c.row},${c.col}) asks for "${answer}" without naming a year or position — ` +
            `if the series name alone reads as an answer, the question is under-specified`
        );
      }
    }
  }

  if (pack.gameId === "nutshell") {
    const candidates = payload.candidates ?? payload.pool ?? payload.words ?? payload;
    if (!Array.isArray(candidates)) {
      problems.push("nutshell payload needs a candidates array");
    } else {
      const hist = {};
      for (const c of candidates) {
        const word = String(c?.word ?? "").trim().toUpperCase();
        if (!/^[A-Z]{3,5}$/.test(word)) {
          problems.push(`candidate "${c?.word}" is dropped by the solver (needs 3-5 letters, A-Z only)`);
          continue;
        }
        if (!String(c?.clue ?? "").trim()) problems.push(`candidate ${word} has an empty clue`);
        hist[word.length] = (hist[word.length] ?? 0) + 1;
      }
      // The pool must be able to fill *some* layout — not one particular one.
      // This used to demand the staircase distribution (2x3, 4x4, 4x5) and
      // rejected every corner-layout pool, which is the shape `daily_grid`
      // returns most often and the first shape the solver tries. Requirements
      // are derived from the pattern library so the check cannot drift from
      // the layouts that actually exist.
      const layouts = patternLengthHistograms();
      const fits = layouts.filter(({ need }) =>
        Object.entries(need).every(([len, count]) => (hist[len] ?? 0) >= count)
      );
      if (layouts.length && fits.length === 0) {
        const have = [3, 4, 5].map((n) => `${hist[n] ?? 0}x${n}`).join(", ");
        const options = layouts
          .map(({ id, need }) => `${id} (${Object.entries(need).map(([l, c]) => `${c}x${l}`).join(", ")})`)
          .join("; ");
        problems.push(
          `pool has ${have}, which fills no layout. One of these distributions is needed: ${options}`
        );
      }
      if (candidates.length < 10) problems.push("a grid needs 10 distinct words");
    }
  }

  if (pack.gameId === "relay") {
    const start = String(payload.startWord ?? "").trim().toUpperCase();
    const end = String(payload.endWord ?? "").trim().toUpperCase();
    const bank = (Array.isArray(payload.wordBank) ? payload.wordBank : [])
      .map((w) => String(w ?? "").trim().toUpperCase())
      .filter(Boolean);

    if (!start || !end || bank.length === 0) {
      problems.push("relay needs startWord, endWord and a non-empty wordBank");
    } else {
      const searchBank = bank.includes(end) ? bank : [...bank, end];
      const shortest = shortestChain(start, end, searchBank);
      if (!shortest) {
        problems.push(`no chain from ${start} to ${end} in the word bank`);
      } else {
        const dfs = dfsChain(start, end, searchBank.filter((w) => w !== start));
        warnings.push(`shortest chain is ${shortest.length} moves: ${shortest.join(" → ")}`);
        if (dfs && dfs.length > shortest.length) {
          warnings.push(
            `parMoves will be ${dfs.length} (the validator's first-found path) but a ` +
              `${shortest.length}-move shortcut exists — players will find the short one`
          );
        }
        if (shortest.length < 3) warnings.push("chain is very short; aim for 4-6 moves");
        if (bank.length < 10) warnings.push(`word bank has only ${bank.length} words; aim for 12-18`);
      }
      for (const word of bank) {
        if (!/^[A-Z]+$/.test(word)) problems.push(`bank word "${word}" has characters no player can match`);
      }
    }
  }


  if (pack.gameId === "waypoint") {
    const target = payload.target || { id: payload.targetLocationId };
    const locations = Array.isArray(payload.locations) ? payload.locations : (Array.isArray(payload.availableLocations) ? payload.availableLocations : []);

    if (locations.length === 0) problems.push("waypoint payload needs a non-empty locations array");

    for (const loc of locations) {
      if (!String(loc?.name ?? "").trim()) problems.push("each location must have a non-empty name");

      const hasCoordsArray = Array.isArray(loc?.coordinates) && loc.coordinates.length === 2;
      const hasLatLon = typeof loc?.latitude === "number" && typeof loc?.longitude === "number";

      if (!hasCoordsArray && !hasLatLon) {
        problems.push(`location ${loc?.name || loc?.id} must have latitude/longitude or a coordinates array`);
      } else {
        const lat = hasCoordsArray ? loc.coordinates[0] : loc.latitude;
        const lon = hasCoordsArray ? loc.coordinates[1] : loc.longitude;
        if (lat < -90 || lat > 90) problems.push(`location ${loc?.name || loc?.id} has invalid latitude ${lat}`);
        if (lon < -180 || lon > 180) problems.push(`location ${loc?.name || loc?.id} has invalid longitude ${lon}`);
      }
    }

    if (!payload.target && !payload.targetLocationId) {
      problems.push("waypoint needs a target object or targetLocationId");
    }

    if (locations.length > 0 && locations.length < 8) {
      warnings.push(`waypoint locations has only ${locations.length} entries; aim for at least 8`);
    }

    // Structural validity is not quality: a bank of real places with real
    // coordinates can still be trivial or a coin flip. Only run this once the
    // coordinates above have checked out, since garbage in makes the analysis
    // meaningless rather than wrong.
    if (problems.length === 0 && locations.length >= 2) {
      const targetId = payload.target?.id ?? payload.target?.name ?? payload.targetLocationId;
      const analysis = analyzeWaypointBank(
        locations,
        targetId,
        typeof payload.maxGuesses === "number" ? payload.maxGuesses : 5
      );
      if (analysis.ok) {
        problems.push(...analysis.problems);
        warnings.push(...analysis.warnings);
      }
    }
  }

  if (pack.gameId === "detour") {
    // Mirrors validatePack in packages/games/src/daily/detour/pack.ts. Anything
    // that is a hard reject there must be a problem here, not a warning, or the
    // preflight passes a pack the submit will bounce.
    const route = Array.isArray(payload.route) ? payload.route : [];
    if (route.length < 2) problems.push("detour route must contain at least 2 hops");

    const candidates = Array.isArray(payload.candidatePois) ? payload.candidatePois : [];
    if (candidates.length < 6) {
      problems.push(`detour candidatePois has only ${candidates.length} entries; at least 6 are required`);
    }

    const districtCounts = new Map();
    const seenIds = new Set();
    for (const poi of candidates) {
      if (!String(poi?.name ?? "").trim()) problems.push("each candidate POI must have a non-empty name");
      const id = String(poi?.id ?? "").trim();
      // Ids key the secret lookup, so a collision resolves a guess to the
      // wrong landmark.
      if (id && seenIds.has(id)) problems.push(`duplicate candidate POI id "${id}"`);
      if (id) seenIds.add(id);
      const d = String(poi?.district ?? "").trim();
      if (d) districtCounts.set(d, (districtCounts.get(d) ?? 0) + 1);
    }

    // Every hop the player must find needs a decoy in its district, or the
    // tier-4 hint — the only one that unshrouds the district — names it.
    for (const hop of route.slice(1)) {
      const d = String(hop?.district ?? "").trim();
      if (d && (districtCounts.get(d) ?? 0) < 2) {
        problems.push(
          `detour district "${d}" holds only the target ${hop?.poiName ?? "?"}; add a decoy landmark there`
        );
      }
    }

    // Tiers 1-3 must not name the target; tier 4 is the location hint. The
    // clues on route[i] describe the journey to route[i + 1], so that is the
    // name they must avoid echoing.
    for (let i = 0; i < route.length - 1; i++) {
      const hop = route[i];
      const clues = hop?.clues ?? {};
      for (const tier of ["tier1_vector", "tier2_stranger", "tier3_category"]) {
        if (!String(clues?.[tier] ?? "").trim()) {
          problems.push(`detour hop ${i} is missing clues.${tier}`);
        }
      }

      const targetName = String(route[i + 1]?.poiName ?? "").trim();
      if (!targetName) continue;
      const words = targetName
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 5);
      const blob = ["tier1_vector", "tier2_stranger"]
        .map((k) => String(clues?.[k] ?? "").toLowerCase())
        .join(" ");
      for (const w of words) {
        if (blob.includes(w)) {
          warnings.push(
            `detour clue on hop ${i} contains "${w}" from its target "${targetName}"; check it does not give the hop away`
          );
          break;
        }
      }
    }
  }

  return { problems, warnings };
}

// --- waypoint discriminability ---------------------------------------------

/**
 * Waypoint has no "is it solvable" question — the target is always in the bank,
 * so a player could name it blind. What can go wrong is quality, and there are
 * exactly two failure modes worth a solver:
 *
 *   - **Trivial.** The feedback from almost any opening guess isolates the
 *     target outright, so the puzzle is over on guess two.
 *   - **A coin flip.** Two candidates sit so close together that no guess in
 *     the bank tells them apart, and a player who reasons perfectly still has
 *     to pick one at random.
 *
 * Both are invisible to `validatePack`, which only checks that coordinates are
 * numerically plausible. This models a player who knows where every candidate
 * is (the names are public, so they do) and reads the feedback the way the UI
 * shows it: an 8-point arrow and a distance they compare approximately.
 */

const WP_EARTH_RADIUS_KM = 6371;
const wpRad = (d) => (d * Math.PI) / 180;

export function wpDistanceKm(a, b) {
  const dLat = wpRad(b.lat - a.lat);
  const dLng = wpRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(wpRad(a.lat)) * Math.cos(wpRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = Math.min(1, Math.max(0, s));
  return WP_EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export function wpBearingDeg(a, b) {
  const dLng = wpRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(wpRad(b.lat));
  const x =
    Math.cos(wpRad(a.lat)) * Math.sin(wpRad(b.lat)) -
    Math.sin(wpRad(a.lat)) * Math.cos(wpRad(b.lat)) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** The 8-point sector a bearing falls in — what the needle actually conveys. */
const wpSector = (deg) => Math.floor((((deg + 22.5) % 360) + 360) % 360 / 45);

/**
 * Can a player tell these two candidates apart from this vantage point?
 *
 * Everything here turns on how precisely you assume the player reads, so there
 * are deliberately two answers, and they measure different things:
 *
 *   - **PRECISE** (2%, floor 75km) is a solver with a mapping tool. If even
 *     *this* reader cannot split two candidates, no one can, and a puzzle that
 *     comes down to that pair is unfair. Used for the coin-flip check.
 *   - **COARSE** (15%, floor 500km) is a person eyeballing "about nine thousand
 *     kilometres, pointing north-east". Used to judge how the puzzle actually
 *     plays, because grading difficulty against the precise reader declares
 *     every globe-spanning bank trivial — the first version of this analyser
 *     did exactly that, and its "100% of openings resolve" verdict was an
 *     artefact of the model, not a fact about the puzzle.
 */
const WP_PRECISE = { rel: 0.02, floor: 75 };
const WP_COARSE = { rel: 0.15, floor: 500 };

function wpSeparates(from, a, b, tolerance) {
  const da = wpDistanceKm(from, a);
  const db = wpDistanceKm(from, b);
  const tol = Math.max(tolerance.floor, tolerance.rel * Math.max(da, db));
  if (Math.abs(da - db) > tol) return true;
  return wpSector(wpBearingDeg(from, a)) !== wpSector(wpBearingDeg(from, b));
}

/**
 * Analyse a bank against its target.
 *
 * Returns `parGuesses` — how many guesses a player who reasons optimally needs,
 * worst case — plus the candidates that can never be told apart from the target
 * and how often a single opening guess gives the whole thing away.
 */
export function analyzeWaypointBank(locations, targetId, maxGuesses = 5) {
  const pts = locations
    .map((l) => {
      const coords = Array.isArray(l?.coordinates) && l.coordinates.length === 2
        ? { lat: l.coordinates[0], lng: l.coordinates[1] }
        : typeof l?.latitude === "number" && typeof l?.longitude === "number"
          ? { lat: l.latitude, lng: l.longitude }
          : null;
      return coords ? { id: l.id ?? l.name, name: l.name, ...coords } : null;
    })
    .filter(Boolean);

  const target = pts.find((p) => p.id === targetId) ?? pts[0];
  if (!target || pts.length < 2) {
    return { ok: false, reason: "not enough located candidates to analyse" };
  }

  // Candidates no guess in the bank can separate from the target. Guessing one
  // of the pair is itself a guess that separates them (you would be told you
  // were right), so a pair is only truly ambiguous if nothing *else* splits it.
  const ambiguousWith = pts
    .filter((p) => p.id !== target.id)
    .filter(
      (p) =>
        !pts.some(
          (g) => g.id !== p.id && g.id !== target.id && wpSeparates(g, p, target, WP_PRECISE)
        )
    )
    .map((p) => p.name);

  // How often does one opening guess leave the target alone, for a player
  // reading roughly? This is the trivially-easy signal.
  let resolvingOpeners = 0;
  for (const g of pts) {
    if (g.id === target.id) continue;
    const survivors = pts.filter(
      (c) => c.id !== g.id && (c.id === target.id || !wpSeparates(g, c, target, WP_COARSE))
    );
    if (survivors.length === 1) resolvingOpeners += 1;
  }
  const openers = pts.length - 1;
  const firstGuessResolveRate = openers > 0 ? resolvingOpeners / openers : 0;

  // Optimal play: probe with whichever candidate leaves the fewest survivors,
  // until only the target remains, then spend one guess naming it. A probe that
  // happens to be the target wins on the spot.
  let remaining = pts.slice();
  let guesses = 0;
  const line = [];
  while (remaining.length > 1 && guesses <= pts.length) {
    let best = null;
    for (const g of remaining) {
      if (g.id === target.id) continue;
      // The guess always leaves the running: you are either told you were
      // right, or told you were not. Forgetting this let the analyser "probe"
      // the same location twice and report an inflated par.
      const survivors = remaining.filter(
        (c) => c.id !== g.id && (c.id === target.id || !wpSeparates(g, c, target, WP_COARSE))
      );
      if (!best || survivors.length < best.survivors.length) best = { g, survivors };
    }
    if (!best) break;
    guesses += 1;
    line.push(`${best.g.name} → ${best.survivors.length} left`);
    if (best.survivors.length === remaining.length) break; // no progress possible
    remaining = best.survivors;
  }
  const parGuesses = guesses + 1; // the guess that names the target

  const problems = [];
  const warnings = [];

  if (ambiguousWith.length > 0) {
    problems.push(
      `waypoint target "${target.name}" cannot be told apart from ${ambiguousWith
        .map((n) => `"${n}"`)
        .join(", ")} by any guess in the bank — the puzzle ends on a coin flip`
    );
  }
  if (parGuesses > maxGuesses) {
    problems.push(
      `waypoint needs ${parGuesses} guesses under optimal play but allows only ${maxGuesses}`
    );
  }
  if (firstGuessResolveRate >= 0.6) {
    warnings.push(
      `waypoint is close to trivial — ${Math.round(firstGuessResolveRate * 100)}% of opening guesses isolate the target outright; add candidates nearer it`
    );
  }
  const sameRegion = locations.filter(
    (l) => (l.region ?? "") === (locations.find((x) => (x.id ?? x.name) === targetId)?.region ?? "")
  ).length;
  if (sameRegion <= 1) {
    warnings.push(
      "waypoint target is the only candidate in its region, so the first bearing gives it away"
    );
  }

  return {
    ok: true,
    target: target.name,
    parGuesses,
    firstGuessResolveRate: Number(firstGuessResolveRate.toFixed(2)),
    ambiguousWith,
    line,
    problems,
    warnings,
  };
}

/** BFS: the route a player will actually find. */
function shortestChain(start, end, bank) {
  const queue = [{ word: start, path: [], used: new Set() }];
  while (queue.length) {
    const { word, path, used } = queue.shift();
    const last = word.at(-1);
    for (let i = 0; i < bank.length; i++) {
      if (used.has(i) || bank[i][0] !== last) continue;
      const next = [...path, bank[i]];
      if (bank[i] === end) return next;
      queue.push({ word: bank[i], path: next, used: new Set(used).add(i) });
    }
    if (path.length > 8) break;
  }
  return null;
}

/** DFS in bank order: what `findValidChain` returns, and therefore parMoves. */
function dfsChain(start, end, bank, used = new Set(), steps = { n: 0 }) {
  if (steps.n++ > 5000) return null;
  const last = start.at(-1);
  for (let i = 0; i < bank.length; i++) {
    if (used.has(i) || bank[i][0] !== last) continue;
    if (bank[i] === end) return [bank[i]];
    used.add(i);
    const rest = dfsChain(bank[i], end, bank, used, steps);
    used.delete(i);
    if (rest) return [bank[i], ...rest];
  }
  return null;
}

// --- commands ---------------------------------------------------------------

async function cmdStatus() {
  const status = await api("/api/admin/daily/queue-status");
  const drafts = await api("/api/admin/daily/review");
  const today = currentPuzzleDate();

  console.log(`today (US Eastern): ${today}   base: ${BASE_URL}\n`);
  for (const [game, s] of Object.entries(status)) {
    const pending = drafts.filter((d) => d.game_id === game).length;
    console.log(
      `${game.padEnd(9)} queued ahead: ${String(s.queuedFutureDays).padStart(2)}  ` +
        `target: ${s.lookaheadDays}  next free: ${s.openDates?.[0] ?? firstFreeDate(s.queuedFutureDays, today)}` +
        (pending ? `  (${pending} draft${pending > 1 ? "s" : ""} awaiting review)` : "")
    );
    if (s.queuedDates?.length) console.log(`${" ".repeat(10)}queued: ${s.queuedDates.join(", ")}`);
    if (s.draftDates?.length) console.log(`${" ".repeat(10)}drafts: ${s.draftDates.join(", ")}`);
    const risk = queueRisk(s.queuedFutureDays);
    if (risk) console.log(`${" ".repeat(10)}⚠ ${risk}`);
  }
  console.log(
    "\nisSufficient=false just means fewer days queued than the lookahead target — " +
      "a queue-health flag, not a failure."
  );
}

async function cmdPlan(args) {
  const lookahead = Number(flagValue(args, "--lookahead") ?? 0);
  const status = await api("/api/admin/daily/queue-status");
  const today = currentPuzzleDate();

  for (const [game, s] of Object.entries(status)) {
    const target = lookahead || s.lookaheadDays;
    const shortBy = Math.max(0, target - s.queuedFutureDays);
    // Prefer the server's own list of free dates: it knows about gaps and about
    // drafts, neither of which the count can express.
    const dates = s.openDates
      ? s.openDates.slice(0, Math.min(shortBy, 3))
      : planDates(s.queuedFutureDays, target, today);
    console.log(`${game.padEnd(9)} ${dates.length ? dates.join(", ") : "queue is full — nothing to do"}`);
  }
}

async function cmdPrompt(args) {
  const [gameId, puzzleDate] = args;
  if (!gameId || !puzzleDate) fail("usage: prompt <gameId> <YYYY-MM-DD>");
  const res = await api(
    `/api/admin/daily/prompt?gameId=${encodeURIComponent(gameId)}&puzzleDate=${encodeURIComponent(puzzleDate)}`
  );
  console.log(res.prompt);
}

async function cmdVerify(files) {
  if (!files.length) fail("usage: verify <pack.json>...");
  let bad = 0;
  for (const file of files) {
    const pack = JSON.parse(await readFile(file, "utf8"));
    const { problems, warnings } = preflight(pack);
    console.log(`\n${file} — ${pack.gameId} ${pack.puzzleDate}`);
    for (const w of warnings) console.log(`  note:  ${w}`);
    for (const p of problems) console.log(`  ERROR: ${p}`);
    if (!problems.length) console.log("  preflight clean (the server's validator is still authoritative)");
    if (problems.length) bad++;
  }
  if (bad) process.exit(1);
}

async function cmdSubmit(args) {
  const files = args.filter((a) => !a.startsWith("--"));
  const confirmed = args.includes("--yes");
  const force = args.includes("--force");
  if (!files.length) fail("usage: submit <pack.json>... --yes [--force]");

  const status = await api("/api/admin/daily/queue-status");
  const drafts = await api("/api/admin/daily/review");
  const today = currentPuzzleDate();
  const draftDates = new Set(drafts.map((d) => `${d.game_id}:${d.puzzle_date}`));

  const planned = [];
  for (const file of files) {
    const pack = JSON.parse(await readFile(file, "utf8"));
    const { problems, warnings } = preflight(pack);
    const blockers = [...problems];

    // Hazard 1: today's puzzle is live, and past dates are history.
    if (pack.puzzleDate <= today) {
      blockers.push(
        `puzzleDate ${pack.puzzleDate} is not in the future — submitting would overwrite a live or past puzzle`
      );
    }

    // Hazard 2: the date is already taken. The API reports exactly which dates
    // hold a puzzle, so this is a lookup rather than an inference; the
    // contiguous-window derivation is the fallback for older deployments.
    const gameStatus = status[pack.gameId];
    const occupied = gameStatus?.queuedDates
      ? gameStatus.queuedDates.includes(pack.puzzleDate)
      : Boolean(gameStatus) && pack.puzzleDate < firstFreeDate(gameStatus.queuedFutureDays, today);
    if (occupied) {
      const msg = `${pack.puzzleDate} already holds a queued puzzle for ${pack.gameId} — this would replace it`;
      if (force) warnings.push(`OVERWRITING: ${msg}`);
      else blockers.push(`${msg} (pass --force to replace it deliberately)`);
    }

    // Hazard 3: drafts are invisible to queue-status.
    if (draftDates.has(`${pack.gameId}:${pack.puzzleDate}`)) {
      const msg = `a draft already exists for ${pack.gameId} ${pack.puzzleDate} and would be replaced`;
      if (force) warnings.push(`OVERWRITING: ${msg}`);
      else blockers.push(`${msg} (review it first, or pass --force)`);
    }

    const willQueue = pack.factCheck?.status === "passed";
    planned.push({ file, pack, blockers, warnings, willQueue });
  }

  console.log(`today (US Eastern): ${today}   base: ${BASE_URL}\n`);
  for (const p of planned) {
    console.log(`${p.file} — ${p.pack.gameId} ${p.pack.puzzleDate} → ${p.willQueue ? "QUEUED (live)" : "draft"}`);
    for (const w of p.warnings) console.log(`  note:  ${w}`);
    for (const b of p.blockers) console.log(`  BLOCK: ${b}`);
  }

  if (planned.some((p) => p.blockers.length)) {
    console.log("\nNothing submitted — resolve the blocks above.");
    process.exit(1);
  }
  if (!confirmed) {
    console.log("\nDry run. Re-run with --yes to submit.");
    return;
  }

  for (const p of planned) {
    const res = await api("/api/admin/daily/submit-pack", {
      method: "POST",
      body: JSON.stringify({
        gameId: p.pack.gameId,
        puzzleDate: p.pack.puzzleDate,
        payload: p.pack.payload,
        sourceRefs: p.pack.sourceRefs ?? [],
        factCheck: p.pack.factCheck,
      }),
    });
    console.log(`submitted ${p.pack.gameId} ${p.pack.puzzleDate} → ${res.status}`);
  }
}

/**
 * Where the secret is coming from, and whether it works — without ever showing
 * it. "Is it configured?" is the question people actually have, and answering
 * it by printing the value is how secrets end up in screenshots.
 */
async function cmdSecret() {
  const fromEnv = Boolean(process.env.DAILY_PIPELINE_SECRET);
  const secret = resolveSecret();

  console.log(`keychain service: ${KEYCHAIN_SERVICE}`);
  console.log(
    `resolved:         ${secret ? "yes" : "NO"}` +
      (fromEnv ? " (from DAILY_PIPELINE_SECRET in the environment)" : secret ? " (from the Keychain)" : "")
  );

  if (!secret) {
    console.log(`\n${SETUP_HINT}`);
    process.exit(1);
  }

  // Length and a hash prefix, never the value. Enough to tell "I stored the
  // wrong thing" from "the deployment disagrees" without printing a credential
  // into a terminal, a screenshot, or a scrollback buffer.
  console.log(`length:           ${secret.length}`);
  console.log(`fingerprint:      ${createHash("sha256").update(secret).digest("hex").slice(0, 12)}`);
  if (secret.length < 16) {
    console.log(
      `\n⚠ That is short for a generated secret. If you meant to store a longer one,\n` +
        `  re-run the setup command below — note the -U, without which the Keychain\n` +
        `  refuses to overwrite and quietly keeps the old value.\n\n${SETUP_HINT}`
    );
  }

  const res = await fetch(`${BASE_URL}/api/admin/daily/queue-status`, {
    headers: { Authorization: `Bearer ${requireSecret()}` },
  });
  console.log(`${BASE_URL} says: ${res.status}${res.ok ? " — the secret works" : " — the secret is not accepted"}`);
  if (!res.ok) {
    console.log(
      `\nThe stored value is not what the deployment expects. Compare fingerprints:\n` +
        `  npx vercel env pull /tmp/e --environment=production --yes && \\\n` +
        `    grep ^DAILY_PIPELINE_SECRET= /tmp/e | cut -d= -f2- | tr -d '"' | tr -d '\\n' | shasum -a 256 | cut -c1-12; rm -f /tmp/e\n` +
        `That prints a hash, not the secret. If it differs from the fingerprint above,\n` +
        `re-store the right value with -U as shown by \`pnpm daily secret\` when unset.`
    );
    process.exit(1);
  }
}

async function cmdReview(args) {
  const full = args.includes("--full");
  const drafts = await api("/api/admin/daily/review");
  if (!drafts.length) return console.log("no drafts awaiting review");

  for (const d of drafts) {
    console.log(`\n${d.id}  ${d.game_id}  ${d.puzzle_date}`);
    console.log(`  fact check: ${d.fact_check ? JSON.stringify(d.fact_check).slice(0, 300) : "none"}`);
    console.log(`  sources: ${(d.source_refs ?? []).map((r) => r.url).join(", ") || "none"}`);
    // Quality smells, not blockers — the draft is approvable either way.
    for (const w of d.warnings ?? []) console.log(`  ⚠ ${w}`);
    // Payloads contain answer keys, so they are opt-in rather than printed by
    // default — this output ends up in terminals, logs and transcripts.
    if (full) console.log(`  payload: ${JSON.stringify(d.payload, null, 2)}`);
  }
  if (!full) console.log("\n(pass --full to print payloads — they contain the answer keys)");
}

async function cmdDecide(args) {
  const id = args.find((a) => !a.startsWith("--"));
  const approve = args.includes("--approve");
  const reject = args.includes("--reject");
  if (!id || approve === reject) fail("usage: decide <id> --approve|--reject");
  if (reject) console.log("note: rejecting DELETES the row — it cannot be recovered.");

  const res = await api(`/api/admin/daily/review/${encodeURIComponent(id)}/decide`, {
    method: "POST",
    body: JSON.stringify({ approve }),
  });
  console.log(`${res.id} → ${res.approved ? "queued" : "deleted"}`);
}

async function cmdUnqueue(args) {
  const positional = args.filter((a) => !a.startsWith("--"));
  const [gameId, puzzleDate] = positional;
  const confirmed = args.includes("--yes");
  if (!gameId || !puzzleDate) fail("usage: unqueue <gameId> <YYYY-MM-DD> --yes");

  const today = currentPuzzleDate();
  // Mirrored server-side, but refusing here means an obvious mistake never
  // leaves the machine — and the message can say why before anything is sent.
  if (puzzleDate <= today) {
    fail(
      `refusing: ${puzzleDate} is not in the future (today is ${today}). ` +
        "Today's puzzle is live and earlier ones are already played."
    );
  }

  console.log(`today (US Eastern): ${today}   base: ${BASE_URL}\n`);
  console.log(`  DELETE ${gameId} ${puzzleDate}`);
  console.log("\nnote: this DELETES the row — it cannot be recovered.");
  console.log("      the date reopens, and the content stops counting as already used.");

  if (!confirmed) {
    console.log("\nnothing sent. re-run with --yes to delete.");
    return;
  }

  const res = await api("/api/admin/daily/unqueue", {
    method: "POST",
    body: JSON.stringify({ gameId, puzzleDate }),
  });
  console.log(`\n${res.gameId} ${res.puzzleDate} → deleted (was ${res.status})`);
}

// --- plumbing ---------------------------------------------------------------

function flagValue(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const commands = {
  secret: cmdSecret,
  status: cmdStatus,
  plan: cmdPlan,
  prompt: cmdPrompt,
  verify: cmdVerify,
  submit: cmdSubmit,
  review: cmdReview,
  decide: cmdDecide,
  unqueue: cmdUnqueue,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = commands[command];
  if (!run) {
    fail(
      `usage: node scripts/daily-content.mjs <${Object.keys(commands).join("|")}>\n` +
        "see the header of this file, and docs/daily-content/pipeline-api.md"
    );
  }
  run(args).catch((err) => fail(String(err?.message ?? err)));
}
