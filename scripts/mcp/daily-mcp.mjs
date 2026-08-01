#!/usr/bin/env node
/**
 * The Merkive daily-content MCP server.
 *
 * A content routine driven by prose has to be told the schemas, the date
 * arithmetic, the overwrite rules, the no-repeat windows, and the secret — and
 * every one of those is a way to get it wrong. This server turns each of them
 * into a tool contract instead:
 *
 *   - the pipeline secret lives here, never in a prompt or a transcript;
 *   - `daily_plan` returns the dates that are actually open, from the server,
 *     rather than a count the caller has to do arithmetic on;
 *   - `daily_grid` hands back a verified Nutshell interlock, so the routine
 *     writes clues instead of attempting crossword construction — and can
 *     build the grid around a research-derived seed answer or a loose theme;
 *   - `daily_check` runs the same preflight the CLI does, before anything is
 *     sent;
 *   - `daily_submit` refuses past dates, occupied dates and repeat puzzles.
 *
 * Selective disclosure is the other half. Tools return the least that lets the
 * next step happen: history comes back as one-way fingerprints plus answers
 * from dates already played, never an unplayed answer key, and nothing here
 * ever echoes the secret. A generator can prove its puzzle is new without being
 * shown the puzzles it must differ from.
 *
 * Transport is stdio JSON-RPC, hand-rolled, no dependencies — the protocol
 * surface a server this small needs is about a hundred lines, and pulling in an
 * SDK for it would be the heaviest thing in the repo's tooling.
 *
 * The pipeline secret is never configured here. `scripts/secret.mjs` reads it
 * from the macOS Keychain at the moment of use, so the MCP config file, this
 * repo, and every transcript stay free of it.
 *
 * Env:
 *   MERKY_BASE_URL         default https://the-merkive.vercel.app
 *   MERKY_LEDGER           default scripts/mcp/.daily-ledger.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import process from "node:process";

import { preflight, currentPuzzleDate, queueRisk } from "../daily-content.mjs";
import { requireSecret } from "../secret.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.MERKY_BASE_URL ?? "https://the-merkive.vercel.app").replace(/\/$/, "");
const LEDGER_PATH = process.env.MERKY_LEDGER ?? join(HERE, ".daily-ledger.json");
const GAMES = ["nexus", "nutshell", "relay", "waypoint", "detour"];

// --- word list + solver, loaded from the game package -----------------------

/**
 * Nutshell construction needs the real solver and the curated word list, both
 * of which are TypeScript. Rather than depend on a build step, read and
 * transpile-free-parse the word list, and re-implement nothing: the grid we
 * propose is verified by the server's own `validatePack` on submit anyway.
 */
function loadWordList() {
  const src = readFileSync(
    resolve(HERE, "../../packages/games/src/daily/nutshell/wordlist.ts"),
    "utf8"
  );
  const body = src.slice(src.indexOf("`") + 1, src.lastIndexOf("`"));
  return body.split(/\s+/).filter((w) => /^[A-Z]{3,5}$/.test(w));
}

/**
 * The precomputed grid bank, or null if it has not been built.
 *
 * Serving must be instant and searching is expensive — the richest layouts take
 * seconds to minutes per fill — so the search happens offline in
 * scripts/build-nutshell-grids.mjs and its output is committed. Falling back to
 * a live search keeps the tool working on a fresh checkout, just slower and
 * with duller grids.
 */
function loadGridBank() {
  try {
    const raw = readFileSync(
      resolve(HERE, "../../packages/games/src/daily/nutshell/grids.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.grids) && parsed.grids.length ? parsed.grids : null;
  } catch {
    return null;
  }
}

function loadPatterns() {
  const src = readFileSync(
    resolve(HERE, "../../packages/games/src/daily/nutshell/patterns.ts"),
    "utf8"
  );
  const patterns = [];
  const re = /id:\s*"([a-z0-9_]+)",\s*gridPattern:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(src))) {
    const rows = [...m[2].matchAll(/"([.#]{5})"/g)].map((r) => r[1]);
    if (rows.length === 5) patterns.push({ id: m[1], gridPattern: rows });
  }
  return patterns;
}

function slotsOf(gridPattern) {
  const across = [];
  const down = [];
  let n = 1;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (gridPattern[r][c] === "#") continue;
      const startsAcross = (c === 0 || gridPattern[r][c - 1] === "#") && c + 1 < 5 && gridPattern[r][c + 1] !== "#";
      const startsDown = (r === 0 || gridPattern[r - 1][c] === "#") && r + 1 < 5 && gridPattern[r + 1][c] !== "#";
      if (!startsAcross && !startsDown) continue;
      const number = n++;
      if (startsAcross) {
        let len = 0;
        while (c + len < 5 && gridPattern[r][c + len] !== "#") len++;
        across.push({ number, row: r, col: c, length: len, dir: "across" });
      }
      if (startsDown) {
        let len = 0;
        while (r + len < 5 && gridPattern[r + len][c] !== "#") len++;
        down.push({ number, row: r, col: c, length: len, dir: "down" });
      }
    }
  }
  return { across, down };
}

/**
 * Ordered, forward-checked fill — the same shape of search the game uses.
 *
 * `required` (Map of slot index → word) pins specific slots before the search
 * starts, which is how a seeded grid is built: the marquee entry is fixed, the
 * everyday fill bends around it. Required slots are searched first so the
 * constraint propagates immediately — the same order a human constructor works
 * in. A required word bypasses both the pool and `avoid`; the caller vouches
 * for it.
 */
function fillGrid(words, pattern, avoid = new Set(), seed = 1, maxSteps = 400_000, required = new Map()) {
  const { across, down } = slotsOf(pattern.gridPattern);
  const slots = [...across, ...down];
  const cells = slots.map((s) =>
    Array.from({ length: s.length }, (_, k) => ({
      r: s.dir === "across" ? s.row : s.row + k,
      c: s.dir === "across" ? s.col + k : s.col,
    }))
  );

  let rand = seed;
  const next = () => (rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pool = [...words];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const grid = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => (pattern.gridPattern[r][c] === "#" ? "#" : null))
  );

  const order = [];
  const placed = new Set();
  const remaining = new Set(slots.map((_, i) => i));
  for (const i of required.keys()) {
    if (!remaining.has(i)) continue;
    order.push(i);
    for (const x of cells[i]) placed.add(`${x.r},${x.c}`);
    remaining.delete(i);
  }
  while (remaining.size) {
    let best = -1;
    let bestOverlap = -1;
    for (const i of remaining) {
      const overlap = cells[i].filter((x) => placed.has(`${x.r},${x.c}`)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = i;
      }
    }
    order.push(best);
    for (const x of cells[best]) placed.add(`${x.r},${x.c}`);
    remaining.delete(best);
  }

  const used = new Set();
  const assigned = new Array(slots.length).fill(null);
  let steps = 0;

  const fits = (w, i) =>
    cells[i].every((x, k) => {
      const letter = grid[x.r][x.c];
      return !letter || letter === "#" || letter === w[k];
    });

  const optionsFor = (i) => {
    const pinned = required.get(i);
    if (pinned !== undefined) {
      return pinned.length === slots[i].length && !used.has(pinned) && fits(pinned, i) ? [pinned] : [];
    }
    return pool.filter(
      (w) => w.length === slots[i].length && !used.has(w) && !avoid.has(w) && fits(w, i)
    );
  };

  const backtrack = (depth) => {
    if (depth === slots.length) return true;
    if (steps++ > maxSteps) return false;
    const i = order[depth];
    for (const word of optionsFor(i)) {
      const prev = cells[i].map((x) => grid[x.r][x.c]);
      cells[i].forEach((x, k) => (grid[x.r][x.c] = word[k]));
      used.add(word);
      assigned[i] = word;
      let viable = true;
      for (let d = depth + 1; d < slots.length; d++) {
        if (optionsFor(order[d]).length === 0) {
          viable = false;
          break;
        }
      }
      if (viable && backtrack(depth + 1)) return true;
      cells[i].forEach((x, k) => (grid[x.r][x.c] = prev[k]));
      used.delete(word);
      assigned[i] = null;
    }
    return false;
  };

  if (!backtrack(0)) return null;
  return {
    patternId: pattern.id,
    gridPattern: pattern.gridPattern,
    across: across.map((s, i) => ({ ...s, answer: assigned[i] })),
    down: down.map((s, i) => ({ ...s, answer: assigned[across.length + i] })),
  };
}

/**
 * First fresh grid across seeds and patterns.
 *
 * A single fill is deterministic given its seed, and the constraint is tight
 * enough that neighbouring seeds sometimes land on the same solution — so
 * "propose a grid" has to be a search over seeds, not one call. Grids whose
 * fingerprint has been used before are skipped, which is what makes "never the
 * same puzzle twice" hold for Nutshell.
 */
/**
 * How good a candidate grid is as a puzzle, not merely as a fill.
 *
 * The solver takes the first thing that fits, and "fits" says nothing about
 * whether the result is fun. Left alone it produced DUD / IRE / BRA / YEW / DIE
 * — every word legitimate, the grid as a whole dour and lifeless. Higher is
 * better; only relative order matters.
 */
export function scoreGrid(words) {
  let score = 0;
  for (const word of words) {
    // Longer entries carry more of the puzzle: a grid of eight 3-letter words
    // is a vocabulary check, not a solve.
    score += word.length >= 5 ? 6 : word.length === 4 ? 3 : 0;
    // Vowel-poor stubs (TSK, BRR) and repeated letters read as filler.
    const vowels = (word.match(/[AEIOU]/g) ?? []).length;
    if (vowels === 0) score -= 4;
    if (new Set(word).size < word.length) score -= 1;
  }
  // Variety of initial letters — ten words starting with four letters feels
  // like the constructor ran out of room, because they did.
  score += new Set(words.map((w) => w[0])).size;
  return score;
}

/**
 * Ranking with an optional theme: a placed theme word outweighs a slightly
 * prettier fill (8 > the 6 a five-letter entry earns), because the theme is
 * the thing the day was built around. With no theme this is scoreGrid.
 */
function rankGrid(words, themeSet) {
  let bonus = 0;
  if (themeSet && themeSet.size) {
    for (const w of words) if (themeSet.has(w)) bonus += 8;
  }
  return scoreGrid(words) + bonus;
}

/** Uppercase and keep only words the solver could ever accept. */
function sanitizeWords(list) {
  return [...new Set((list ?? []).map((w) => String(w).trim().toUpperCase()))].filter((w) =>
    /^[A-Z]{3,5}$/.test(w)
  );
}

/** Stable per-date seed, so a given day is reproducible but days differ. */
function seedFor(puzzleDate) {
  return parseInt(sha(`nutshell|seed|${puzzleDate ?? ""}`).slice(0, 8), 16) % 100_000;
}

/** Rough ceiling on how good a pattern's grids can be, for search ordering. */
function patternPotential(pattern) {
  const { across, down } = slotsOf(pattern.gridPattern);
  return scoreGrid([...across, ...down].map((s) => "X".repeat(s.length)));
}

/**
 * Best fresh grid, not merely the first.
 *
 * Two things make this a search rather than a call. A fill is deterministic
 * given its seed, so variety has to come from trying seeds; and the patterns
 * differ enormously in both quality and cost. The corner layouts fill in ~20ms
 * but are eight three-letter words — a vocabulary check, not a solve. The
 * staircases score three times higher and take ~5s. One denser layout scores
 * higher still and took nearly four minutes, which is not a tool call.
 *
 * So: richest patterns first, spend up to `budgetMs` collecting unused
 * candidates, return the best scoring one. The cheap corner patterns are
 * guaranteed to be reachable within any budget, so there is always an answer.
 */
function proposeGrid(
  words,
  patterns,
  {
    avoidWords = new Set(),
    usedFingerprints = new Set(),
    themeSet = new Set(),
    seeds = 200,
    sample = 8,
    budgetMs = 25_000,
    stepsPerFill = 150_000,
    puzzleDate,
  } = {}
) {
  const base = seedFor(puzzleDate);
  const deadline = Date.now() + budgetMs;
  const candidates = [];

  const ordered = [...patterns].sort((a, b) => patternPotential(b) - patternPotential(a));

  for (const pattern of ordered) {
    if (Date.now() >= deadline && candidates.length) break;
    for (let i = 1; i <= seeds && candidates.length < sample; i++) {
      if (Date.now() >= deadline && candidates.length) break;
      // Cap each individual fill too. The deadline alone is not enough: one
      // call on a dense pattern ran for nearly four minutes, and a budget that
      // is only checked between calls cannot interrupt it.
      const grid = fillGrid(words, pattern, avoidWords, (base + i) * 7919 + 13, stepsPerFill);
      if (!grid) break; // unfillable from this pool within the step ceiling
      const payload = { across: grid.across, down: grid.down };
      const fingerprint = fingerprintPuzzle("nutshell", payload);
      if (usedFingerprints.has(fingerprint)) continue;
      if (candidates.some((c) => c.fingerprint === fingerprint)) continue;
      candidates.push({ grid, fingerprint });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      rankGrid([...b.grid.across, ...b.grid.down].map((s) => s.answer), themeSet) -
      rankGrid([...a.grid.across, ...a.grid.down].map((s) => s.answer), themeSet)
  );
  return candidates[0].grid;
}

/**
 * A grid built around a required "seed" answer — the marquee entry a routine
 * derives from the week's events. Candidates are ranked: the first one the
 * everyday fill can actually surround wins, and the rest of that day's list is
 * not tried. Letter shape decides more than fame here (measured: MOANA places
 * in ~25ms, MARIO never does within a tool budget), which is why the contract
 * is a ranked list rather than a single word, and why every rejection is
 * reported back with a reason instead of silently vanishing.
 *
 * Pattern order is corners first, staircases second, and both are tried: the
 * corner layouts cost tens of milliseconds and guarantee a floor, then the
 * rest of the seed's time slice goes on the staircases, which score twice as
 * high and land in ~1–10s when seeded (anchoring a slot prunes the search, so
 * a live call can afford what an unseeded search could not). The best-ranked
 * success wins. Ordering it the other way round starves the floor: a seed the
 * staircases cannot take burns its whole slice and is rejected even though a
 * corner grid existed. The dense blocked layouts stay offline in the bank
 * builder.
 */
function proposeSeededGrid(
  words,
  patterns,
  seedWords,
  {
    avoidWords = new Set(),
    usedFingerprints = new Set(),
    themeSet = new Set(),
    budgetMs = 25_000,
    perSeedMs = 9_000,
    stepsPerFill = 150_000,
    rngTries = 3,
    puzzleDate,
  } = {}
) {
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const ordered = ["corners_3x3", "corners_3x3_mirror", "staircase_tl_br", "staircase_tr_bl"]
    .map((id) => byId.get(id))
    .filter(Boolean);
  if (ordered.length === 0) ordered.push(...patterns);

  const base = seedFor(puzzleDate);
  const deadline = Date.now() + budgetMs;
  const rejected = [];
  let attempt = 0;

  for (const raw of seedWords) {
    const seedWord = String(raw).trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(seedWord)) {
      rejected.push({ word: seedWord || String(raw), reason: "not 3-5 letters A-Z" });
      continue;
    }
    if (Date.now() >= deadline) {
      rejected.push({ word: seedWord, reason: "budget exhausted before this candidate was tried" });
      continue;
    }

    const sliceDeadline = Math.min(Date.now() + perSeedMs, deadline);
    let best = null;
    let hadSlot = false;

    for (const pattern of ordered) {
      if (Date.now() >= sliceDeadline) break;
      const { across, down } = slotsOf(pattern.gridPattern);
      const slots = [...across, ...down];
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].length !== seedWord.length) continue;
        hadSlot = true;
        for (let t = 0; t < rngTries; t++) {
          if (Date.now() >= sliceDeadline) break;
          attempt++;
          const grid = fillGrid(
            words,
            pattern,
            avoidWords,
            (base + attempt) * 7919 + 13,
            stepsPerFill,
            new Map([[i, seedWord]])
          );
          if (!grid) continue;
          const fingerprint = fingerprintPuzzle("nutshell", { across: grid.across, down: grid.down });
          if (usedFingerprints.has(fingerprint)) continue;
          const rank = rankGrid([...grid.across, ...grid.down].map((s) => s.answer), themeSet);
          if (!best || rank > best.rank) {
            best = { grid, rank, slot: { ...slots[i], dir: slots[i].dir } };
          }
          break; // one fresh fill per slot is enough; other slots may rank higher
        }
      }
    }

    if (best) {
      return {
        grid: best.grid,
        seedUsed: {
          word: seedWord,
          dir: best.slot.dir,
          row: best.slot.row,
          col: best.slot.col,
          length: best.slot.length,
        },
        seedsRejected: rejected,
      };
    }
    rejected.push({
      word: seedWord,
      reason: hadSlot
        ? "no fresh everyday fill surrounds it within budget — its letters are the problem, not its fame"
        : "no layout has a slot of that length",
    });
  }

  return { grid: null, seedUsed: null, seedsRejected: rejected };
}

/**
 * A grid that actually carries a theme, not one that might.
 *
 * Ranking alone cannot deliver a theme: sampled fills almost never contain a
 * given ten-word vocabulary by chance (measured: eight samples, zero theme
 * words placed). So themes reuse the required-placement mechanism — each theme
 * word is tried as an anchor, guaranteeing one placement, and the ranking then
 * rewards whatever other theme words the fill picked up opportunistically from
 * the pool. Unlike seeds, theme words are equals: every anchor is tried and
 * the best-ranked result wins, rather than the first.
 */
function proposeThemedGrid(
  words,
  patterns,
  themeSet,
  {
    avoidWords = new Set(),
    usedFingerprints = new Set(),
    budgetMs = 10_000,
    stepsPerFill = 60_000,
    rngTries = 2,
    maxAnchors = 8,
    puzzleDate,
  } = {}
) {
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const ordered = ["corners_3x3", "corners_3x3_mirror", "staircase_tl_br", "staircase_tr_bl"]
    .map((id) => byId.get(id))
    .filter(Boolean);
  if (ordered.length === 0) ordered.push(...patterns);

  const base = seedFor(puzzleDate);
  const deadline = Date.now() + budgetMs;
  let attempt = 0;
  let best = null;

  for (const anchor of [...themeSet].slice(0, maxAnchors)) {
    if (Date.now() >= deadline) break;
    for (const pattern of ordered) {
      if (Date.now() >= deadline) break;
      const { across, down } = slotsOf(pattern.gridPattern);
      const slots = [...across, ...down];
      let anchored = false;
      for (let i = 0; i < slots.length && !anchored; i++) {
        if (slots[i].length !== anchor.length) continue;
        for (let t = 0; t < rngTries; t++) {
          if (Date.now() >= deadline) break;
          attempt++;
          const grid = fillGrid(
            words,
            pattern,
            avoidWords,
            (base + attempt) * 6151 + 29,
            stepsPerFill,
            new Map([[i, anchor]])
          );
          if (!grid) continue;
          const fingerprint = fingerprintPuzzle("nutshell", { across: grid.across, down: grid.down });
          if (usedFingerprints.has(fingerprint)) continue;
          const rank = rankGrid([...grid.across, ...grid.down].map((s) => s.answer), themeSet);
          if (!best || rank > best.rank) best = { grid, rank };
          anchored = true; // one home per (anchor, pattern) bounds the cost
          break;
        }
      }
    }
  }

  return best?.grid ?? null;
}

// --- ledger -----------------------------------------------------------------

/**
 * Local record of what this machine submitted.
 *
 * The server's history digest is the authority — it sees every puzzle from
 * every source. The ledger exists for the things the server cannot know: what
 * was proposed but not yet sent, and a fast local answer for "have I used this
 * word recently" between runs.
 */
function readLedger() {
  if (!existsSync(LEDGER_PATH)) return { submissions: [] };
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  } catch {
    return { submissions: [] };
  }
}

function writeLedger(ledger) {
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Must match apps/web/src/server/daily/fingerprint.ts exactly. */
function puzzleItems(gameId, payload) {
  const p = payload ?? {};
  if (gameId === "nexus") {
    return (Array.isArray(p.cells) ? p.cells : []).map((c) => norm(c?.answer)).filter(Boolean).sort();
  }
  if (gameId === "nutshell") {
    const slots = [...(p.across ?? []), ...(p.down ?? [])];
    const fromSlots = slots.map((s) => norm(s?.answer)).filter(Boolean).sort();
    if (fromSlots.length) return fromSlots;
    // A submission carries candidates, not an assembled grid; the server
    // fingerprints the assembled payload, so locally we can only approximate.
    const cands = p.candidates ?? p.pool ?? p.words ?? [];
    return Array.isArray(cands) ? cands.map((c) => norm(c?.word)).filter(Boolean).sort() : [];
  }
  if (gameId === "relay") {
    const pair = `${norm(p.startWord)}->${norm(p.endWord)}`;
    return pair === "->" ? [] : [pair];
  }
  if (gameId === "waypoint") {
    const target = p.target;
    const locs = p.locations ?? p.availableLocations ?? [];
    const names = Array.isArray(locs) ? locs.map((l) => norm(l?.name)).filter(Boolean).sort() : [];
    const targetName = norm(target?.name);
    return targetName ? [targetName, ...names] : names;
  }
  if (gameId === "detour") {
    // Must stay in step with puzzleItems() in
    // apps/web/src/server/daily/fingerprint.ts — the server fingerprints the
    // submitted pack, so a divergence here just makes the local repeat check
    // disagree with the one that actually gates the submit.
    const cityName = norm(p.cityName);
    const route = Array.isArray(p.route) ? p.route : [];
    const routeIds = route.map((r) => norm(r?.poiId ?? r?.poiName)).filter(Boolean);
    const cands = Array.isArray(p.candidatePois) ? p.candidatePois : [];
    const candIds = cands.map((c) => norm(c?.id ?? c?.name)).filter(Boolean).sort();
    return [cityName, ...routeIds, ...candIds].filter(Boolean);
  }
  return [];
}

function fingerprintPuzzle(gameId, payload) {
  const items = puzzleItems(gameId, payload);
  if (!items.length) return sha(`${gameId}|raw|${JSON.stringify(payload ?? null)}`);
  return sha(`${gameId}|${items.join("|")}`);
}

const itemToken = (gameId, item) => sha(`${gameId}|item|${item}`);

// --- api --------------------------------------------------------------------

async function api(path, init = {}) {
  // Resolved per call (cached in-process) rather than captured at startup, so
  // the secret is never held in this module's scope longer than it is needed.
  const secret = requireSecret();
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
    // Never let a transport error carry the secret back to the caller.
    const detail = typeof body === "object" && body ? JSON.stringify(body) : String(body ?? "");
    throw new Error(`${res.status} ${path}: ${detail}`);
  }
  return body;
}

// --- tools ------------------------------------------------------------------

const TOOLS = [
  {
    name: "daily_plan",
    description:
      "What each daily game needs right now: which future dates already hold a queued puzzle or a pending draft, which dates are open, and whether the queue is dangerously shallow. Call this first — it replaces guessing dates from a count. Returns no puzzle content.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string", enum: GAMES, description: "Omit for all games." },
      },
    },
  },
  {
    name: "daily_brief",
    description:
      "The authoring brief for one game and date, generated from the game's own code (so the schema and, for Nutshell, the grid geometry are always current). Use it as the spec for what to produce.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string", enum: GAMES },
        puzzleDate: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["gameId", "puzzleDate"],
    },
  },
  {
    name: "daily_history",
    description:
      "What must not be repeated. Returns one-way fingerprints for every past and pending puzzle, plus — only for dates already played — the answers in the clear so you can vary content. Never returns an unplayed answer key. Use `avoid` to see which of your candidate items are already spent.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string", enum: GAMES },
        items: {
          type: "array",
          items: { type: "string" },
          description: "Candidate answers/words/pairs to test against history.",
        },
      },
      required: ["gameId"],
    },
  },
  {
    name: "daily_grid",
    description:
      "A verified Nutshell interlock, filled from the repo's curated everyday word list and guaranteed not to repeat a past grid. You supply clues for the ten words it returns — you do not have to construct a crossword. Optionally pass seedWords (ranked topical answer candidates from your research — the grid is built around the first that fits, everything else stays everyday fill) and/or themeWords (a loose theme vocabulary the fill prefers opportunistically). Call `daily_submit` with those words and clues.",
    inputSchema: {
      type: "object",
      properties: {
        puzzleDate: { type: "string", description: "YYYY-MM-DD" },
        avoidWords: {
          type: "array",
          items: { type: "string" },
          description: "Extra words to keep out of the fill (e.g. this week's other grids).",
        },
        seedWords: {
          type: "array",
          items: { type: "string" },
          description:
            "Ranked candidates (best first, give 3-6) for ONE required topical answer, each 3-5 letters A-Z, each verified against a retrieved source before you pass it. The grid is built around the first that fits; the response reports seedUsed and seedsRejected. Letter shape decides what fits — vowel-rich candidates place far more often — so always give alternatives.",
        },
        themeWords: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional loose-theme vocabulary: 10-20 everyday 3-5 letter words around one theme. Grids containing more of them are preferred and themeWordsPlaced reports what landed. Nothing is guaranteed — theme what lands, drop what doesn't.",
        },
      },
      required: ["puzzleDate"],
    },
  },
  {
    name: "daily_check",
    description:
      "Preflight a pack without sending it: schema, game-specific rules, cross-cell answer leaks, Relay shortcuts, and whether it repeats a past puzzle. Always call this before daily_submit.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string", enum: GAMES },
        puzzleDate: { type: "string" },
        payload: { type: "object" },
        sourceRefs: { type: "array", items: { type: "object" } },
        factCheck: { type: "object" },
        replaceDraft: {
          type: "boolean",
          description:
            "Mirror the same flag you intend to pass to daily_submit, so the dry run reflects what will actually happen.",
        },
      },
      required: ["gameId", "puzzleDate", "payload"],
    },
  },
  {
    name: "daily_submit",
    description:
      "Submit a pack. Refuses a date that is not in the future, a date that already holds a puzzle or draft, and any puzzle whose content has been used before. Lands as a draft for human review unless factCheck.status is 'passed' — the only two permitted values are 'passed' and 'needs_review'.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string", enum: GAMES },
        puzzleDate: { type: "string" },
        payload: { type: "object" },
        sourceRefs: { type: "array", items: { type: "object" } },
        factCheck: { type: "object" },
        replaceDraft: {
          type: "boolean",
          description:
            "Replace a draft already sitting on this date. Use to correct a pack you drafted by mistake — most often one that should have carried factCheck.status 'passed'. Never replaces a queued puzzle, and never touches today or the past.",
        },
      },
      required: ["gameId", "puzzleDate", "payload"],
    },
  },
];

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const err = (message) => ({ content: [{ type: "text", text: message }], isError: true });

async function callTool(name, args = {}) {
  if (name === "daily_plan") {
    const status = await api(
      `/api/admin/daily/queue-status${args.gameId ? `?gameId=${encodeURIComponent(args.gameId)}` : ""}`
    );
    const today = currentPuzzleDate();
    const games = {};
    for (const [game, s] of Object.entries(status)) {
      games[game] = {
        ...s,
        urgent: queueRisk(s.queuedFutureDays) ?? undefined,
        nextTargets: (s.openDates ?? []).slice(0, Math.max(0, (s.lookaheadDays ?? 3) - s.queuedFutureDays)).slice(0, 3),
      };
    }
    return ok({ today, games });
  }

  if (name === "daily_brief") {
    const res = await api(
      `/api/admin/daily/prompt?gameId=${encodeURIComponent(args.gameId)}&puzzleDate=${encodeURIComponent(args.puzzleDate)}`
    );
    return ok(res);
  }

  if (name === "daily_history") {
    const res = await api(`/api/admin/daily/history?gameId=${encodeURIComponent(args.gameId)}`);
    const digests = res.digests ?? [];
    const spent = new Set(digests.flatMap((d) => d.itemTokens ?? []));
    const playedItems = digests.flatMap((d) => d.recentItems ?? []);
    const tested = (args.items ?? []).map((item) => ({
      item,
      used: spent.has(itemToken(args.gameId, norm(item))),
    }));
    return ok({
      gameId: args.gameId,
      puzzleCount: digests.length,
      alreadyUsed: tested.filter((t) => t.used).map((t) => t.item),
      stillFree: tested.filter((t) => !t.used).map((t) => t.item),
      answersFromPlayedDates: playedItems.slice(0, 200),
    });
  }

  if (name === "daily_grid") {
    const res = await api(`/api/admin/daily/history?gameId=nutshell`);
    const usedFingerprints = new Set((res.digests ?? []).map((d) => d.fingerprint));
    const avoidWords = new Set((args.avoidWords ?? []).map((w) => String(w).toUpperCase()));
    const themeList = sanitizeWords(args.themeWords);
    const themeSet = new Set(themeList);
    const seedList = Array.isArray(args.seedWords) ? args.seedWords : [];
    // Theme words join the everyday pool so the fill can actually use them;
    // seeds never do — a seed enters a grid only as the required entry.
    const pool = themeList.length ? [...new Set([...loadWordList(), ...themeList])] : loadWordList();

    const slot = (s) => ({ number: s.number, row: s.row, col: s.col, length: s.length, answer: s.answer });
    const respond = (grid, source, extras = {}) => {
      const answers = [...grid.across, ...grid.down].map((s) => s.answer);
      return ok({
        puzzleDate: args.puzzleDate,
        patternId: grid.patternId,
        gridPattern: grid.gridPattern,
        across: grid.across.map(slot),
        down: grid.down.map(slot),
        candidates: answers.map((word) => ({ word, clue: "<write an original clue>" })),
        seedUsed: extras.seedUsed ?? null,
        seedsRejected: extras.seedsRejected ?? [],
        themeWordsPlaced: themeSet.size ? answers.filter((w) => themeSet.has(w)) : [],
        source,
        note: extras.seedUsed
          ? "Write an original clue for each of the ten words; clue the seed word through what made " +
            "it current, never through anyone's private life. A seeded grid asserts a real-world " +
            "fact, so include a sourceRef for the page that verified the seed and submit with " +
            "factCheck.status 'needs_review'. The server re-verifies the interlock on submit."
          : "Write an original clue for each of the ten words, then call daily_submit with " +
            "payload.candidates. The server re-verifies the interlock and will reject anything " +
            "that does not agree.",
      });
    };

    // Seeds first: a topical marquee answer can only come from a live seeded
    // search — the bank was filled from the everyday list before this week
    // happened. If every candidate fails, fall through and say why.
    let seedsRejected = [];
    if (seedList.length) {
      const seeded = proposeSeededGrid(pool, loadPatterns(), seedList, {
        avoidWords,
        usedFingerprints,
        themeSet,
        puzzleDate: args.puzzleDate,
      });
      if (seeded.grid) {
        return respond(seeded.grid, "seeded live search", seeded);
      }
      seedsRejected = seeded.seedsRejected;
    }

    // The bank is ordered best-first and every entry is already known distinct,
    // so serving is a scan rather than a search.
    const bank = loadGridBank();
    const fresh = bank
      ? bank.filter(
          (g) =>
            !usedFingerprints.has(g.fingerprint) &&
            ![...g.across, ...g.down].some((s) => avoidWords.has(s.answer))
        )
      : [];

    // A theme has to be delivered, not hoped for. First choice: a bank grid
    // that already carries it (two placed words — one stray match is not a
    // theme). Otherwise anchor theme words live; a result that carries the
    // theme beats the bank, and one that merely brushes it (a single word)
    // only wins when there is no bank grid to prefer.
    if (themeSet.size) {
      if (fresh.length) {
        const themed = fresh
          .map((g) => {
            const answers = [...g.across, ...g.down].map((s) => s.answer);
            return {
              g,
              count: answers.filter((w) => themeSet.has(w)).length,
              rank: rankGrid(answers, themeSet),
            };
          })
          .sort((a, b) => b.rank - a.rank)[0];
        if (themed && themed.count >= 2) {
          return respond(themed.g, `bank, theme-matched (${themed.count} theme words)`, { seedsRejected });
        }
      }
      const themedGrid = proposeThemedGrid(pool, loadPatterns(), themeSet, {
        avoidWords,
        usedFingerprints,
        puzzleDate: args.puzzleDate,
      });
      if (themedGrid) {
        const placed = [...themedGrid.across, ...themedGrid.down].filter((s) =>
          themeSet.has(s.answer)
        ).length;
        if (placed >= 2 || !fresh.length) {
          return respond(themedGrid, `themed live search (${placed} theme words)`, { seedsRejected });
        }
      }
    }

    if (fresh.length) {
      // Deterministic per date, so a re-run for the same day is stable, while
      // different days draw different grids from the top of the bank.
      const pick = fresh[seedFor(args.puzzleDate) % Math.min(fresh.length, 8)] ?? fresh[0];
      return respond(pick, `bank (${fresh.length} unused of ${bank.length})`, { seedsRejected });
    }

    // Fallback only: restrict to the cheap corner layouts. The richer patterns
    // are worth minutes offline and are exactly why the bank exists, but a tool
    // call cannot spend them.
    const cheap = loadPatterns().filter((p) => p.id.startsWith("corners"));
    const grid = proposeGrid(pool, cheap.length ? cheap : loadPatterns(), {
      avoidWords,
      usedFingerprints,
      themeSet,
      puzzleDate: args.puzzleDate,
      budgetMs: 8_000,
      stepsPerFill: 60_000,
    });
    if (!grid) {
      return err(
        "Could not find a grid that has not been used before. Rebuild the bank with " +
          "`node scripts/build-nutshell-grids.mjs`, or add words to " +
          "packages/games/src/daily/nutshell/wordlist.ts."
      );
    }
    return respond(grid, bank ? "live search (bank exhausted)" : "live search (no bank built)", {
      seedsRejected,
    });
  }

  if (name === "daily_check" || name === "daily_submit") {
    const pack = {
      gameId: args.gameId,
      puzzleDate: args.puzzleDate,
      payload: args.payload,
      sourceRefs: args.sourceRefs ?? [],
      factCheck: args.factCheck,
    };
    const { problems, warnings } = preflight(pack);
    const today = currentPuzzleDate();

    const blockers = [...problems];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.puzzleDate ?? "")) {
      blockers.push("puzzleDate must be YYYY-MM-DD");
    } else if (pack.puzzleDate <= today) {
      blockers.push(`${pack.puzzleDate} is not in the future — that would overwrite a live or past puzzle`);
    }

    const status = await api(`/api/admin/daily/queue-status?gameId=${encodeURIComponent(pack.gameId)}`);
    const entry = status[pack.gameId] ?? {};
    if ((entry.queuedDates ?? []).includes(pack.puzzleDate)) {
      blockers.push(`${pack.puzzleDate} already holds a queued puzzle for ${pack.gameId}`);
    }
    // A draft normally blocks its date, so a pending human decision is never
    // silently overwritten. But that also walled a generator in: having landed
    // a pack as a draft it could not resubmit (this blocker) and cannot approve
    // (deliberately not a tool), so a pack drafted by mistake — a mistyped
    // factCheck.status, say — was stranded with no move available.
    //
    // `replaceDraft` is the way out, and it only ever reaches a draft. A draft
    // has never been shown to a player, so replacing one destroys nothing. The
    // queued-date blocker below is untouched and unconditional.
    const replacingOwnDraft =
      args.replaceDraft === true && (entry.draftDates ?? []).includes(pack.puzzleDate);
    if ((entry.draftDates ?? []).includes(pack.puzzleDate) && !replacingOwnDraft) {
      blockers.push(
        `${pack.puzzleDate} already holds a draft awaiting review` +
          " (pass replaceDraft: true to replace it — only ever allowed for a draft, never a queued puzzle)"
      );
    }

    const history = await api(`/api/admin/daily/history?gameId=${encodeURIComponent(pack.gameId)}`);
    // When replacing a draft, that draft's own content must not count as
    // "already used" — otherwise resubmitting the identical pack to fix its
    // status would be refused as a repeat of itself.
    const digests = (history.digests ?? []).filter(
      (d) => !(replacingOwnDraft && d.puzzleDate === pack.puzzleDate)
    );
    const spentFingerprints = new Set(digests.map((d) => d.fingerprint));
    const spentItems = new Set(digests.flatMap((d) => d.itemTokens ?? []));
    const items = puzzleItems(pack.gameId, pack.payload);
    if (spentFingerprints.has(fingerprintPuzzle(pack.gameId, pack.payload))) {
      blockers.push("this exact puzzle has been used before — daily puzzles are never repeated");
    }
    const reused = items.filter((i) => spentItems.has(itemToken(pack.gameId, i)));
    if (reused.length) {
      const msg = `reuses ${reused.length} item(s) from earlier puzzles: ${reused.slice(0, 8).join(", ")}`;
      if (pack.gameId === "relay") blockers.push(msg);
      else warnings.push(msg);
    }

    if (name === "daily_check") {
      return ok({
        gameId: pack.gameId,
        puzzleDate: pack.puzzleDate,
        wouldSubmit: blockers.length === 0,
        blockers,
        warnings,
        landsAs: pack.factCheck?.status === "passed" ? "queued (live)" : "draft (awaits review)",
      });
    }

    if (blockers.length) {
      return err(`Not submitted.\n- ${blockers.join("\n- ")}`);
    }

    const result = await api("/api/admin/daily/submit-pack", {
      method: "POST",
      body: JSON.stringify(pack),
    });

    const ledger = readLedger();
    ledger.submissions.push({
      at: new Date().toISOString(),
      gameId: pack.gameId,
      puzzleDate: pack.puzzleDate,
      status: result.status,
      fingerprint: fingerprintPuzzle(pack.gameId, pack.payload),
      items,
    });
    writeLedger(ledger);

    return ok({ ...result, warnings });
  }

  return err(`Unknown tool: ${name}`);
}

// --- stdio JSON-RPC ---------------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(request) {
  const { id, method, params } = request;
  if (method === "initialize") {
    return {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "merkive-daily", version: "1.0.0" },
    };
  }
  if (method === "tools/list") return { tools: TOOLS };
  if (method === "tools/call") {
    try {
      return await callTool(params?.name, params?.arguments ?? {});
    } catch (e) {
      return err(String(e?.message ?? e));
    }
  }
  if (method === "ping") return {};
  throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
}

/**
 * Only speak JSON-RPC when actually run as a server. Importing this file (the
 * tests do) must not attach a stdin listener that keeps the process alive.
 */
function serve() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;

      let request;
      try {
        request = JSON.parse(line);
      } catch {
        continue;
      }

      try {
        const result = await handle(request);
        // Notifications carry no id and must not be answered.
        if (request.id !== undefined && request.id !== null) {
          send({ jsonrpc: "2.0", id: request.id, result });
        }
      } catch (e) {
        if (request.id !== undefined && request.id !== null) {
          send({
            jsonrpc: "2.0",
            id: request.id,
            error: { code: e?.code ?? -32603, message: String(e?.message ?? e) },
          });
        }
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) serve();

export { fillGrid, proposeGrid, proposeSeededGrid, proposeThemedGrid, loadWordList, loadPatterns, fingerprintPuzzle, puzzleItems, handle, TOOLS };
