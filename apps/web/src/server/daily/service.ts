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

  const today = localDateFor(timezone);
  if (puzzleDate > today) {
    throw new ServiceError("future_puzzle", "Cannot access a future puzzle.", 400);
  }

  const puzzle = await store.getPuzzle(gameId, puzzleDate);
  if (!puzzle) {
    throw new ServiceError("no_puzzle_today", `No puzzle found for date: ${puzzleDate}`, 404);
  }

  await store.upsertDevice(deviceId, timezone);

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
  const today = localDateFor(timezone);
  return getOrCreateAttempt(gameId, today, deviceId, timezone);
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

  const today = localDateFor(timezone);
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
    attempt.on_time = localDateFor(timezone, Date.now()) === puzzleDate;
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
  const beforeDate = before || localDateFor(timezone);
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
  const today = localDateFor(timezone);
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
  const today = localDateFor(timezone);

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
    msUntilRollover: msUntilLocalRollover(timezone),
    games,
  };
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
