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
 *     writes clues instead of attempting crossword construction;
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
 * Env:
 *   DAILY_PIPELINE_SECRET  required
 *   MERKY_BASE_URL         default https://the-merkive.vercel.app
 *   MERKY_LEDGER           default scripts/mcp/.daily-ledger.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import process from "node:process";

import { preflight, todayUtc, queueRisk } from "../daily-content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.MERKY_BASE_URL ?? "https://the-merkive.vercel.app").replace(/\/$/, "");
const LEDGER_PATH = process.env.MERKY_LEDGER ?? join(HERE, ".daily-ledger.json");
const GAMES = ["nexus", "nutshell", "relay"];

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

/** Ordered, forward-checked fill — the same shape of search the game uses. */
function fillGrid(words, pattern, avoid = new Set(), seed = 1) {
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

  const optionsFor = (i) =>
    pool.filter((w) => {
      if (w.length !== slots[i].length || used.has(w) || avoid.has(w)) return false;
      return cells[i].every((x, k) => {
        const letter = grid[x.r][x.c];
        return !letter || letter === "#" || letter === w[k];
      });
    });

  const backtrack = (depth) => {
    if (depth === slots.length) return true;
    if (steps++ > 400_000) return false;
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
function proposeGrid(words, patterns, { avoidWords = new Set(), usedFingerprints = new Set(), seeds = 200 } = {}) {
  // Patterns outer, seeds inner. Most of the library cannot be filled from an
  // everyday word list at all, and each failed attempt costs a full exhaustive
  // search — so exhaust the seeds of a pattern that works before paying for one
  // that does not.
  for (const pattern of patterns) {
    for (let seed = 1; seed <= seeds; seed++) {
      const grid = fillGrid(words, pattern, avoidWords, seed * 7919 + 13);
      if (!grid) break; // this pattern cannot be filled from this pool at all
      const payload = { across: grid.across, down: grid.down };
      if (usedFingerprints.has(fingerprintPuzzle("nutshell", payload))) continue;
      return grid;
    }
  }
  return null;
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
  const secret = process.env.DAILY_PIPELINE_SECRET;
  if (!secret) {
    throw new Error(
      "DAILY_PIPELINE_SECRET is not set for the MCP server. Add it to the server's env in your MCP config — never to a prompt."
    );
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
      "A verified Nutshell interlock, filled from the repo's curated everyday word list and guaranteed not to repeat a past grid. You supply clues for the ten words it returns — you do not have to construct a crossword. Call `daily_submit` with those words and clues.",
    inputSchema: {
      type: "object",
      properties: {
        puzzleDate: { type: "string", description: "YYYY-MM-DD" },
        avoidWords: {
          type: "array",
          items: { type: "string" },
          description: "Extra words to keep out of the fill (e.g. this week's other grids).",
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
      },
      required: ["gameId", "puzzleDate", "payload"],
    },
  },
  {
    name: "daily_submit",
    description:
      "Submit a pack. Refuses a date that is not in the future, a date that already holds a puzzle or draft, and any puzzle whose content has been used before. Lands as a draft for human review unless factCheck.status is 'passed'.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string", enum: GAMES },
        puzzleDate: { type: "string" },
        payload: { type: "object" },
        sourceRefs: { type: "array", items: { type: "object" } },
        factCheck: { type: "object" },
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
    const today = todayUtc();
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
    const words = loadWordList();
    const patterns = loadPatterns();
    const res = await api(`/api/admin/daily/history?gameId=nutshell`);
    const usedFingerprints = new Set((res.digests ?? []).map((d) => d.fingerprint));
    const avoidWords = new Set((args.avoidWords ?? []).map((w) => String(w).toUpperCase()));

    const grid = proposeGrid(words, patterns, { avoidWords, usedFingerprints });
    if (!grid) {
      return err(
        "Could not build a grid that has not been used before. Drop some avoidWords, or the curated word list needs more entries — see packages/games/src/daily/nutshell/wordlist.ts."
      );
    }

    const slot = (s) => ({ number: s.number, row: s.row, col: s.col, length: s.length, answer: s.answer });
    return ok({
      puzzleDate: args.puzzleDate,
      patternId: grid.patternId,
      gridPattern: grid.gridPattern,
      across: grid.across.map(slot),
      down: grid.down.map(slot),
      candidates: [...grid.across, ...grid.down].map((s) => ({ word: s.answer, clue: "<write an original clue>" })),
      note: "Write an original clue for each of the ten words, then call daily_submit with payload.candidates. The server re-verifies the interlock and will reject anything that does not agree.",
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
    const today = todayUtc();

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
    if ((entry.draftDates ?? []).includes(pack.puzzleDate)) {
      blockers.push(`${pack.puzzleDate} already holds a draft awaiting review`);
    }

    const history = await api(`/api/admin/daily/history?gameId=${encodeURIComponent(pack.gameId)}`);
    const spentFingerprints = new Set((history.digests ?? []).map((d) => d.fingerprint));
    const spentItems = new Set((history.digests ?? []).flatMap((d) => d.itemTokens ?? []));
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

export { fillGrid, proposeGrid, loadWordList, loadPatterns, fingerprintPuzzle, puzzleItems, handle, TOOLS };
