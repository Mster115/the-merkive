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
 *   node scripts/daily-content.mjs status
 *   node scripts/daily-content.mjs plan [--lookahead 5]
 *   node scripts/daily-content.mjs prompt <gameId> <YYYY-MM-DD>
 *   node scripts/daily-content.mjs verify <pack.json>...        # offline
 *   node scripts/daily-content.mjs submit <pack.json>... --yes [--force]
 *   node scripts/daily-content.mjs review [--full]
 *   node scripts/daily-content.mjs decide <id> --approve|--reject
 *
 * Env:
 *   DAILY_PIPELINE_SECRET  required for anything touching the API
 *   MERKY_BASE_URL         default https://the-merkive.vercel.app
 */

import { readFile } from "node:fs/promises";
import process from "node:process";

const BASE_URL = (process.env.MERKY_BASE_URL ?? "https://the-merkive.vercel.app").replace(/\/$/, "");
const SECRET = process.env.DAILY_PIPELINE_SECRET;
const GAMES = ["nexus", "nutshell", "relay"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- date helpers -----------------------------------------------------------

/**
 * Server-side "today". `getQueueStatus` compares against
 * `new Date().toISOString().slice(0, 10)`, so the queue arithmetic has to use
 * the same UTC date — a local date would drift by one for most of the day and
 * silently shift every target.
 */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The first date safe to write, given how many future days are already queued.
 *
 * `queuedFutureDays` counts dates >= today, so a contiguous queue occupies
 * today .. today+(n-1) and the first free date is today+n — NOT today+n+1,
 * which would leave a hole. Floored at tomorrow, because today's puzzle is
 * live and must never be rewritten.
 */
export function firstFreeDate(queuedFutureDays, today = todayUtc()) {
  const derived = addDays(today, Math.max(queuedFutureDays, 0));
  const tomorrow = addDays(today, 1);
  return derived > tomorrow ? derived : tomorrow;
}

/**
 * Whether the queue is deep enough to survive timezone rollover.
 *
 * A device's "today" is `localDateFor(device.timezone)`, not server UTC — so a
 * player in UTC+14 asks for tomorrow's puzzle up to 14 hours before UTC agrees
 * it is tomorrow. With only today queued (queuedFutureDays === 1), those
 * players get `no_puzzle_today` for most of their evening; at 0, everyone does.
 * One spare day is the floor, not a nicety.
 */
export function queueRisk(queuedFutureDays) {
  if (queuedFutureDays <= 0) {
    return "EMPTY — no puzzle is queued for today; every device 404s";
  }
  if (queuedFutureDays === 1) {
    return "only today is queued — devices east of UTC roll over first and will see no puzzle";
  }
  return null;
}

export function planDates(queuedFutureDays, lookahead, today = todayUtc(), maxPerRun = 3) {
  const dates = [];
  let cursor = firstFreeDate(queuedFutureDays, today);
  while (queuedFutureDays + dates.length < lookahead && dates.length < maxPerRun) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

// --- api --------------------------------------------------------------------

function requireSecret() {
  if (!SECRET) {
    fail(
      "DAILY_PIPELINE_SECRET is not set.\n" +
        "Export it before running: export DAILY_PIPELINE_SECRET=…\n" +
        "(It is never printed or written to disk by this script.)"
    );
  }
  return SECRET;
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecret()}`,
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
      fail(`Unauthorized (401) from ${path}. DAILY_PIPELINE_SECRET is missing or wrong.`);
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
        warnings.push(`cell ${key} lists no acceptableAnswers — one guess per cell is unforgiving`);
      }
    }

    // Questions are broadcast in publicState from the first render, so a
    // question containing another cell's answer hands that cell away for free.
    // Easy to do by accident: "named after the Titans" gives away TITAN, and
    // "when a volcano's magma reservoir collapses" gives away MAGMA.
    for (const q of cells) {
      const text = String(q?.question ?? "").toLowerCase();
      for (const a of cells) {
        if (a === q) continue;
        const answer = String(a?.answer ?? "").trim().toLowerCase();
        if (answer.length >= 4 && text.includes(answer)) {
          problems.push(
            `cell (${q.row},${q.col}) question contains the answer to cell (${a.row},${a.col}) — "${a.answer}"`
          );
        }
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
      // Staircase layouts need 2x3, 4x4, 4x5. Fewer than that of any length
      // means no layout can be filled, whatever else the pool contains.
      const need = { 3: 2, 4: 4, 5: 4 };
      for (const [len, count] of Object.entries(need)) {
        if ((hist[len] ?? 0) < count) {
          problems.push(`only ${hist[len] ?? 0} ${len}-letter words; a staircase grid needs ${count}`);
        }
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

  return { problems, warnings };
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
  const today = todayUtc();

  console.log(`today (UTC): ${today}   base: ${BASE_URL}\n`);
  for (const [game, s] of Object.entries(status)) {
    const pending = drafts.filter((d) => d.game_id === game).length;
    console.log(
      `${game.padEnd(9)} queued ahead: ${String(s.queuedFutureDays).padStart(2)}  ` +
        `target: ${s.lookaheadDays}  next free: ${firstFreeDate(s.queuedFutureDays, today)}` +
        (pending ? `  (${pending} draft${pending > 1 ? "s" : ""} awaiting review)` : "")
    );
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
  const today = todayUtc();

  for (const [game, s] of Object.entries(status)) {
    const target = lookahead || s.lookaheadDays;
    const dates = planDates(s.queuedFutureDays, target, today);
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
  const today = todayUtc();
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

    // Hazard 2: the contiguous-queue window, derived from the count.
    const gameStatus = status[pack.gameId];
    if (gameStatus && pack.puzzleDate < firstFreeDate(gameStatus.queuedFutureDays, today)) {
      const msg =
        `${pack.puzzleDate} falls inside the ${gameStatus.queuedFutureDays}-day queued window ` +
        `for ${pack.gameId} — this would replace an existing puzzle`;
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

  console.log(`today (UTC): ${today}   base: ${BASE_URL}\n`);
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

async function cmdReview(args) {
  const full = args.includes("--full");
  const drafts = await api("/api/admin/daily/review");
  if (!drafts.length) return console.log("no drafts awaiting review");

  for (const d of drafts) {
    console.log(`\n${d.id}  ${d.game_id}  ${d.puzzle_date}`);
    console.log(`  fact check: ${d.fact_check ? JSON.stringify(d.fact_check).slice(0, 300) : "none"}`);
    console.log(`  sources: ${(d.source_refs ?? []).map((r) => r.url).join(", ") || "none"}`);
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
  status: cmdStatus,
  plan: cmdPlan,
  prompt: cmdPrompt,
  verify: cmdVerify,
  submit: cmdSubmit,
  review: cmdReview,
  decide: cmdDecide,
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
