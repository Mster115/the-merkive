import { matchRng } from "@merky/game-sdk";
import { dailyGameList, getDailyGame } from "@merky/games/daily";
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
import { localDateFor, msUntilLocalRollover } from "./timezone";
import { computeStreaks } from "./streaks";

/**
 * The timezone a device's "today" should be computed in.
 *
 * `x-mb-tz` reports wherever the device is right now, so travelling rewrites
 * the local date mid-day. Moving west can push it *backwards*, re-serving a
 * puzzle the device already played and letting the same day be scored twice.
 *
 * The stored zone therefore wins unless the incoming one does not rewind the
 * local date: travelling forward is adopted immediately, travelling back waits
 * until the new zone catches up. Devices with no row yet take the header.
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

  return {
    puzzleDate,
    publicState: attempt.public_state,
    phase: attempt.phase,
    meta: game.meta,
    attemptOver: isOver,
    status: attempt.status,
    shareText: attempt.share_text,
    summary,
  };
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

export async function getQueueStatus(gameId?: string) {
  const store = getDailyStore();
  const lookaheadDays = parseInt(process.env.DAILY_QUEUE_LOOKAHEAD_DAYS ?? "3", 10);
  const gamesToQuery = gameId ? [gameId] : dailyGameList.map((g) => g.meta.id);

  const results: Record<string, { queuedFutureDays: number; lookaheadDays: number; isSufficient: boolean }> = {};
  for (const id of gamesToQuery) {
    const status = await store.getQueueStatus(id);
    results[id] = {
      queuedFutureDays: status.queuedFutureDays,
      lookaheadDays,
      isSufficient: status.queuedFutureDays >= lookaheadDays,
    };
  }
  return results;
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

  const isFactChecked =
    typeof factCheck === "object" &&
    factCheck !== null &&
    (factCheck as { status?: string }).status === "passed";

  const status = isFactChecked ? "queued" : "draft";
  await store.insertPack(valid.pack, status, factCheck);

  return { ok: true, status, gameId, puzzleDate };
}

export async function listDrafts(gameId?: string) {
  const store = getDailyStore();
  return store.listDraftPacks(gameId);
}

export async function decideDraft(id: string, approve: boolean) {
  const store = getDailyStore();
  await store.decideDraftPack(id, approve);
  return { ok: true, id, approved: approve };
}
