import { matchRng } from "@merky/game-sdk";
import { contentWarnings, dailyGameList, getDailyGame } from "@merky/games/daily";
import {
  isDailyReduceError,
  type DailyContentPack,
  type DailyContext,
  type DailyStateIn,
  type DailyAction,
} from "@merky/games/daily/types";
import type { DailyAttemptRow, DailyPuzzleRow } from "@merky/db";
import { ServiceError } from "../errors";
import { getDailyStore } from "./store";
import { localDateFor, msUntilLocalRollover, currentPuzzleDate } from "./timezone";
import { computeStreaks } from "./streaks";
import { checkRepeat, digestPuzzle, type PuzzleDigest } from "./fingerprint";

/**
 * The timezone a device's "today" should be computed in.
 *
 * With the global Eastern reset, `requestTimezone` is always `DAILY_TIMEZONE`
 * and this function is the migration valve for devices whose stored zone
 * predates it: the stored zone wins unless the incoming one does not rewind
 * the device's local date. A device stored east of Eastern therefore keeps its
 * old (later) date until Eastern catches up — never re-serving a day it
 * already played — and converges permanently the first time it checks in
 * while the dates agree. Devices stored west of Eastern adopt it immediately.
 * New devices take the fixed zone from the start.
 */
export async function effectiveTimezone(
  deviceId: string,
  requestTimezone: string,
  /** Injectable so the comparison can be pinned; any two zones share a local
   *  date for part of every day, which would otherwise make this untestable. */
  nowMs: number = Date.now()
): Promise<string> {
  const device = await getDailyStore().getDevice(deviceId);
  if (!device) return requestTimezone;

  const stored = device.timezone;
  if (stored === requestTimezone) return stored;

  return localDateFor(requestTimezone, nowMs) >= localDateFor(stored, nowMs)
    ? requestTimezone
    : stored;
}

export function listGames() {
  return dailyGameList.map((g) => g.meta);
}

export async function getOrCreateAttempt(
  gameId: string,
  puzzleDate: string,
  deviceId: string,
  timezone: string
) {
  const store = getDailyStore();
  const game = getDailyGame(gameId);
  if (!game) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }

  const tz = await effectiveTimezone(deviceId, timezone);
  const today = localDateFor(tz);
  if (puzzleDate > today) {
    throw new ServiceError("future_puzzle", "Cannot access a future puzzle.", 400);
  }

  const puzzle = await store.getPuzzle(gameId, puzzleDate);
  if (!puzzle) {
    throw new ServiceError("no_puzzle_today", `No puzzle found for date: ${puzzleDate}`, 404);
  }

  await store.upsertDevice(deviceId, tz);

  let attempt = await store.getAttempt(deviceId, puzzle.id);
  if (!attempt) {
    const pack: DailyContentPack = {
      gameId,
      puzzleDate,
      payload: puzzle.payload,
      sourceRefs: puzzle.source_refs,
    };
    const seed = `${gameId}:${puzzleDate}`;
    const ctx: DailyContext = {
      gameId,
      puzzleDate,
      seed,
      now: Date.now(),
      rng: matchRng(seed, 0),
    };

    const initRes = game.init(ctx, pack);
    const nowIso = new Date().toISOString();

    attempt = {
      id: crypto.randomUUID(),
      device_id: deviceId,
      puzzle_id: puzzle.id,
      game_id: gameId,
      puzzle_date: puzzleDate,
      phase: initRes.phase,
      public_state: initRes.publicState,
      secret_state: initRes.secretState,
      version: 0,
      status: "in_progress",
      on_time: false,
      started_at: nowIso,
      completed_at: null,
      duration_ms: null,
      score: null,
      share_text: null,
      updated_at: nowIso,
    };

    await store.upsertAttempt(attempt);
  }

  const isOver = attempt.status !== "in_progress";
  let summary = undefined;
  if (isOver) {
    const seed = `${gameId}:${puzzleDate}`;
    const ctx: DailyContext = {
      gameId,
      puzzleDate,
      seed,
      now: Date.now(),
      rng: matchRng(seed, attempt.version),
    };
    summary = game.summarize(ctx, {
      publicState: attempt.public_state,
      secretState: attempt.secret_state,
      phase: attempt.phase,
    });
  }

  // Sent on first paint so the shell knows whether to auto-open the
  // how-to-play modal without a second round-trip (and without a flash of the
  // board for a returning player).
  const device = await store.getDevice(deviceId);
  const howToSeen = (device?.seen_howto ?? []).includes(gameId);

  return {
    puzzleDate,
    publicState: attempt.public_state,
    phase: attempt.phase,
    meta: game.meta,
    attemptOver: isOver,
    status: attempt.status,
    shareText: attempt.share_text,
    summary,
    howToSeen,
  };
}

export async function markHowToSeen(deviceId: string, gameId: string) {
  const store = getDailyStore();
  if (!getDailyGame(gameId)) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }
  await store.markHowToSeen(deviceId, gameId);
  return { ok: true as const };
}

export async function getTodayOrCreateAttempt(
  gameId: string,
  deviceId: string,
  timezone: string
) {
  const tz = await effectiveTimezone(deviceId, timezone);
  const today = localDateFor(tz);
  return getOrCreateAttempt(gameId, today, deviceId, tz);
}

export async function applyAction(
  gameId: string,
  puzzleDate: string,
  deviceId: string,
  timezone: string,
  action: DailyAction
) {
  const store = getDailyStore();
  const game = getDailyGame(gameId);
  if (!game) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }

  const tz = await effectiveTimezone(deviceId, timezone);
  const today = localDateFor(tz);
  if (puzzleDate > today) {
    throw new ServiceError("future_puzzle", "Cannot apply action to a future puzzle.", 400);
  }

  const puzzle = await store.getPuzzle(gameId, puzzleDate);
  if (!puzzle) {
    throw new ServiceError("no_puzzle", `Puzzle not found for date: ${puzzleDate}`, 404);
  }

  const attempt = await store.getAttempt(deviceId, puzzle.id);
  if (!attempt) {
    throw new ServiceError("no_attempt", "No attempt found. Start the puzzle first.", 404);
  }

  if (attempt.status !== "in_progress") {
    throw new ServiceError("attempt_over", "This puzzle attempt is already finished.", 409);
  }

  const nextVersion = attempt.version + 1;
  const seed = `${gameId}:${puzzleDate}`;
  const ctx: DailyContext = {
    gameId,
    puzzleDate,
    seed,
    now: Date.now(),
    rng: matchRng(seed, nextVersion),
  };

  const stateIn: DailyStateIn = {
    publicState: attempt.public_state,
    secretState: attempt.secret_state,
    phase: attempt.phase,
  };

  const result = game.reduce(ctx, stateIn, action);
  if (isDailyReduceError(result)) {
    throw new ServiceError(result.code, result.error, 400);
  }

  attempt.version = nextVersion;
  attempt.public_state = result.publicState;
  attempt.phase = result.phase;
  if (result.secretState !== undefined) {
    attempt.secret_state = result.secretState;
  }
  attempt.updated_at = new Date().toISOString();

  let summary = undefined;
  if (result.attemptOver) {
    const finalState: DailyStateIn = {
      publicState: result.publicState,
      secretState: result.secretState ?? attempt.secret_state,
      phase: result.phase,
    };
    summary = game.summarize(ctx, finalState);
    attempt.status = summary.status;
    attempt.share_text = summary.shareText;
    attempt.completed_at = new Date().toISOString();
    attempt.duration_ms = Date.now() - new Date(attempt.started_at).getTime();
    attempt.score = summary.stats.score ?? null;
    // Strict same-day streak rule: only counts as "on time" if completion
    // falls on puzzleDate itself in the device's own timezone. An archive
    // puzzle solved later is still recorded (and counts toward totalSolved)
    // but must never patch a gap in current/longest — see streaks.ts.
    attempt.on_time = localDateFor(tz, Date.now()) === puzzleDate;
  }

  await store.upsertAttempt(attempt);

  return {
    puzzleDate,
    publicState: attempt.public_state,
    phase: attempt.phase,
    status: attempt.status,
    shareText: attempt.share_text,
    attemptOver: attempt.status !== "in_progress",
    summary,
  };
}

export async function getArchive(
  gameId: string,
  deviceId: string,
  timezone: string,
  before?: string,
  limit = 30
) {
  const store = getDailyStore();
  const tz = await effectiveTimezone(deviceId, timezone);
  const beforeDate = before || localDateFor(tz);
  const puzzles = await store.listArchivePuzzles(gameId, beforeDate, limit);

  const results = await Promise.all(
    puzzles.map(async (p) => {
      const attempt = await store.getAttempt(deviceId, p.id);
      return {
        puzzleDate: p.puzzle_date,
        status: attempt ? attempt.status : "not_played",
        completedAt: attempt?.completed_at ?? null,
        durationMs: attempt?.duration_ms ?? null,
        score: attempt?.score ?? null,
      };
    })
  );

  return results;
}

export async function getHistory(gameId: string, deviceId: string, timezone: string) {
  const store = getDailyStore();
  const tz = await effectiveTimezone(deviceId, timezone);
  const today = localDateFor(tz);
  const rows = await store.listAttemptsForStreak(deviceId, gameId, 365);
  const streaks = computeStreaks(rows, today);

  const totalPlayed = rows.length;
  const winRate = totalPlayed > 0 ? (streaks.totalSolved / totalPlayed) * 100 : 0;

  return {
    streaks,
    stats: {
      totalPlayed,
      totalSolved: streaks.totalSolved,
      winRate: Math.round(winRate),
    },
  };
}

export interface DailyGameSummary {
  id: string;
  nameKey: string;
  /** Whether a puzzle is actually queued for this game today. */
  hasPuzzle: boolean;
  /** This device's state for today: never started, or the attempt's status. */
  status: "unplayed" | "in_progress" | "solved" | "failed";
  currentStreak: number;
}

/**
 * Per-device, read-only snapshot of today across every daily game, plus how
 * long until the next rollover. Powers the status ticker.
 *
 * Deliberately does NOT create attempts: merely opening the hub must not mark
 * a game as played, which is what getTodayOrCreateAttempt would do.
 */
export async function getSummary(deviceId: string, timezone: string) {
  const store = getDailyStore();
  const tz = await effectiveTimezone(deviceId, timezone);
  const today = localDateFor(tz);

  const games: DailyGameSummary[] = await Promise.all(
    dailyGameList.map(async (game) => {
      const id = game.meta.id;
      const puzzle = await store.getPuzzle(id, today);

      let status: DailyGameSummary["status"] = "unplayed";
      if (puzzle) {
        const attempt = await store.getAttempt(deviceId, puzzle.id);
        if (attempt) {
          status =
            attempt.status === "solved" || attempt.status === "failed"
              ? attempt.status
              : "in_progress";
        }
      }

      const rows = await store.listAttemptsForStreak(deviceId, id, 365);
      return {
        id,
        nameKey: game.meta.nameKey,
        hasPuzzle: Boolean(puzzle),
        status,
        currentStreak: computeStreaks(rows, today).current,
      };
    })
  );

  return {
    today,
    msUntilRollover: msUntilLocalRollover(tz),
    games,
  };
}

/**
 * Crockford-style alphabet: no I, L, O or U, so a code read off one screen and
 * typed into another cannot be garbled by 1/I, 0/O, or spelled into a word.
 */
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RECOVERY_GROUPS = 4;
const RECOVERY_GROUP_LEN = 4;

function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_GROUPS * RECOVERY_GROUP_LEN));
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < RECOVERY_GROUPS; i++) {
    groups.push(chars.slice(i * RECOVERY_GROUP_LEN, (i + 1) * RECOVERY_GROUP_LEN).join(""));
  }
  return groups.join("-");
}

/** Accepts a code however it was typed: any case, with or without dashes. */
export function normalizeRecoveryCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += RECOVERY_GROUP_LEN) {
    groups.push(cleaned.slice(i, i + RECOVERY_GROUP_LEN));
  }
  return groups.join("-");
}

/**
 * This device's recovery code, generated on first request and stable after.
 * Clearing cookies or switching device otherwise loses all history — the code
 * is the only way back to it, so it is issued lazily rather than to every
 * visitor who never asks.
 */
export async function getOrCreateRecoveryCode(deviceId: string, timezone: string) {
  const store = getDailyStore();
  await store.upsertDevice(deviceId, await effectiveTimezone(deviceId, timezone));

  const device = await store.getDevice(deviceId);
  if (device?.recovery_code) return { code: device.recovery_code };

  const code = generateRecoveryCode();
  await store.setRecoveryCode(deviceId, code);
  return { code };
}

/**
 * Resolves a recovery code to the device that owns it. The caller adopts that
 * id as its own cookie, so both browsers then share one history — that is the
 * point, and why the code is a bearer credential worth ~80 bits.
 *
 * Deliberately not single-use: someone restoring onto a third device (or
 * retyping after a typo) must not be locked out by their own first attempt.
 */
export async function redeemRecoveryCode(code: string) {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) {
    throw new ServiceError("invalid_code", "Enter a recovery code.", 400);
  }

  const device = await getDailyStore().findDeviceByRecoveryCode(normalized);
  if (!device) {
    throw new ServiceError("unknown_code", "That recovery code does not match a device.", 404);
  }
  return { deviceId: device.id };
}

// --- Admin Services ---

export interface QueueStatusEntry {
  queuedFutureDays: number;
  lookaheadDays: number;
  isSufficient: boolean;
  /** Dates from today onward that already hold a queued puzzle. */
  queuedDates: string[];
  /** Dates from today onward holding a draft — invisible to the count above. */
  draftDates: string[];
  /** The next dates with nothing on them at all, soonest first. */
  openDates: string[];
}

/**
 * Queue health per game.
 *
 * `queuedDates` / `draftDates` / `openDates` exist because the count alone
 * forced every caller to assume the queue was contiguous from today and derive
 * the next free date arithmetically — an assumption that silently overwrites a
 * puzzle the moment it stops holding. The dates are cheap and remove the guess.
 */
export async function getQueueStatus(gameId?: string): Promise<Record<string, QueueStatusEntry>> {
  const store = getDailyStore();
  const lookaheadDays = parseInt(process.env.DAILY_QUEUE_LOOKAHEAD_DAYS ?? "3", 10);
  const gamesToQuery = gameId ? [gameId] : dailyGameList.map((g) => g.meta.id);
  // Queue arithmetic runs on the product's day — the Eastern reset date — so
  // "future" here flips at the same instant the players' puzzles do.
  const today = currentPuzzleDate();

  const results: Record<string, QueueStatusEntry> = {};
  for (const id of gamesToQuery) {
    const status = await store.getQueueStatus(id, today);
    const rows = await store.listPuzzles(id, 400);
    const future = rows.filter((r) => r.puzzle_date >= today);
    const queuedDates = future.filter((r) => r.status === "queued").map((r) => r.puzzle_date).sort();
    const draftDates = future.filter((r) => r.status === "draft").map((r) => r.puzzle_date).sort();

    const taken = new Set([...queuedDates, ...draftDates]);
    const openDates: string[] = [];
    for (let offset = 1; openDates.length < lookaheadDays + 2 && offset <= 60; offset++) {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + offset);
      const iso = d.toISOString().slice(0, 10);
      if (!taken.has(iso)) openDates.push(iso);
    }

    results[id] = {
      queuedFutureDays: status.queuedFutureDays,
      lookaheadDays,
      isSufficient: status.queuedFutureDays >= lookaheadDays,
      queuedDates,
      draftDates,
      openDates,
    };
  }
  return results;
}

/**
 * One-way content digest of a game's history.
 *
 * Deliberately not the puzzles themselves: fingerprints and hashed item tokens
 * let a caller prove "this is new" without ever seeing an unplayed answer key.
 * Items from dates already played are returned in the clear, since every player
 * that day saw them anyway and a generator needs them to vary its content.
 */
export async function getHistoryDigest(gameId: string, limit = 400): Promise<{
  gameId: string;
  digests: PuzzleDigest[];
}> {
  const game = getDailyGame(gameId);
  if (!game) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }
  const today = currentPuzzleDate();
  const rows = await getDailyStore().listPuzzles(gameId, limit);
  return { gameId, digests: rows.map((r) => digestPuzzle(r, today)) };
}

export async function getPrompt(gameId: string, puzzleDate: string) {
  const game = getDailyGame(gameId);
  if (!game) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }
  return {
    gameId,
    puzzleDate,
    prompt: game.generatePrompt(puzzleDate),
  };
}

/**
 * The only two values `factCheck.status` may carry.
 *
 * `"passed"` queues the pack directly; `"needs_review"` holds it as a draft.
 * Anything else is a typo, and used to draft silently — see `submitPack`.
 */
export const FACT_CHECK_STATUSES = ["passed", "needs_review"] as const;
export type FactCheckStatus = (typeof FACT_CHECK_STATUSES)[number];

export async function submitPack(
  gameId: string,
  puzzleDate: string,
  payload: unknown,
  sourceRefs: { url: string; title: string }[] = [],
  factCheck?: unknown
) {
  const store = getDailyStore();
  const game = getDailyGame(gameId);
  if (!game) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }

  const rawPack = { gameId, puzzleDate, payload, sourceRefs };
  const valid = game.validatePack(rawPack, puzzleDate);
  if (!valid.ok) {
    throw new ServiceError("invalid_pack", valid.error, 400);
  }

  // Never ship the same puzzle twice. Checked against the assembled payload
  // rather than the submission, so a reshuffled word bank or reordered cells
  // still resolves to the same fingerprint.
  const history = (await store.listPuzzles(gameId, 800))
    .filter((r) => r.puzzle_date !== puzzleDate)
    .map((r) => digestPuzzle(r, "9999-12-31"));
  const repeat = checkRepeat(gameId, valid.pack.payload, history);
  if (!repeat.ok) {
    throw new ServiceError(
      "duplicate_puzzle",
      `This puzzle was already used on ${repeat.duplicateOf}. Daily puzzles are never repeated.`,
      409
    );
  }

  // `factCheck` stays free-form, but `status` is a two-value contract, and
  // getting it wrong used to fail *silently*: any unrecognised value simply
  // drafted, so a pack that should have queued sat waiting for a human nobody
  // knew to summon. Observed in the wild: "unreviewed", "not_applicable", and
  // packs omitting factCheck entirely — which is how three days of Relay and
  // Nutshell content, all of it eligible to queue, ended up as drafts.
  //
  // Reject an unrecognised status rather than guessing what it meant. Omitting
  // factCheck altogether stays legal and still drafts: "I did not check" is a
  // real answer, "I checked and the answer is "not_applicable"" is a typo.
  const factCheckStatus =
    typeof factCheck === "object" && factCheck !== null
      ? (factCheck as { status?: unknown }).status
      : undefined;

  if (factCheckStatus !== undefined && !FACT_CHECK_STATUSES.includes(factCheckStatus as FactCheckStatus)) {
    throw new ServiceError(
      "invalid_fact_check_status",
      `factCheck.status must be one of ${FACT_CHECK_STATUSES.map((s) => `"${s}"`).join(" or ")}, ` +
        `got ${JSON.stringify(factCheckStatus)}. ` +
        `"passed" queues the pack; "needs_review" holds it as a draft for a human. ` +
        `Omit factCheck entirely if you did not fact-check at all.`,
      400
    );
  }

  const status = factCheckStatus === "passed" ? "queued" : "draft";
  await store.insertPack(valid.pack, status, factCheck);

  return {
    ok: true,
    status,
    gameId,
    puzzleDate,
    /** Items this puzzle shares with earlier ones — not fatal, but worth seeing. */
    overlaps: repeat.overlaps,
  };
}

export async function listDrafts(gameId?: string) {
  const store = getDailyStore();
  const drafts = await store.listDraftPacks(gameId);
  // Advisory only — a draft with warnings is still approvable. They exist so a
  // reviewer sees a quality smell before it goes live, not to gate the queue.
  return drafts.map((d) => ({
    ...d,
    warnings: contentWarnings(d.game_id, d.payload),
  }));
}

export async function decideDraft(id: string, approve: boolean) {
  const store = getDailyStore();
  await store.decideDraftPack(id, approve);
  return { ok: true, id, approved: approve };
}

/**
 * Removes a future puzzle so its date opens up again.
 *
 * The mirror image of `submitPack`, and it refuses on the same principle: it
 * will not touch a puzzle that is live or already played. Two guards, both
 * server-side because the CLI is not the only possible caller —
 *
 *  1. `puzzleDate` must be strictly in the future. Today's puzzle is being
 *     played right now and past ones are somebody's history.
 *  2. The row must have no attempts. `daily_attempts.puzzle_id` cascades on
 *     delete, so removing a played puzzle would silently destroy attempt rows
 *     and the streaks derived from them.
 *
 * Deleting a row also releases its content fingerprint, so the puzzle stops
 * counting as "already used" and equivalent content may be generated again.
 */
export async function unqueuePuzzle(gameId: string, puzzleDate: string) {
  const store = getDailyStore();

  if (!getDailyGame(gameId)) {
    throw new ServiceError("game_unknown", `Unknown daily game: ${gameId}`, 404);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    throw new ServiceError("invalid_request", `puzzleDate must be YYYY-MM-DD, got "${puzzleDate}"`, 400);
  }

  const today = currentPuzzleDate();
  if (puzzleDate <= today) {
    throw new ServiceError(
      "date_not_future",
      `Refusing to unqueue ${puzzleDate}: only future puzzles can be removed, and today is ${today}. ` +
        "Today's puzzle is live and earlier ones are already played.",
      400
    );
  }

  const puzzle = await store.getPuzzle(gameId, puzzleDate);
  if (!puzzle) {
    throw new ServiceError("not_found", `No ${gameId} puzzle queued for ${puzzleDate}`, 404);
  }

  const attempts = await store.countAttemptsForPuzzle(puzzle.id);
  if (attempts > 0) {
    throw new ServiceError(
      "puzzle_has_attempts",
      `Refusing to unqueue ${gameId} ${puzzleDate}: ${attempts} attempt(s) reference it, ` +
        "and deleting the puzzle would cascade and destroy them.",
      409
    );
  }

  await store.deletePuzzleById(puzzle.id);
  return { ok: true, gameId, puzzleDate, status: puzzle.status, deleted: true };
}
