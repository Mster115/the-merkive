import type { DailyPuzzleRow, DailyDeviceRow, DailyAttemptRow } from "@merky/db";
import type { DailyContentPack } from "@merky/games/daily/types";
import type { StreakRow } from "../streaks";

export interface DailyStore {
  readonly kind: "memory" | "supabase";
  upsertDevice(id: string, timezone: string): Promise<void>;
  getDevice(id: string): Promise<DailyDeviceRow | null>;
  /** Sets the device's recovery code. Codes are unique across devices. */
  setRecoveryCode(deviceId: string, code: string): Promise<void>;
  /**
   * Records that this device has been shown `gameId`'s how-to-play modal.
   * Idempotent — marking an already-seen game is a no-op, so the client may
   * fire it without checking first.
   */
  markHowToSeen(deviceId: string, gameId: string): Promise<void>;
  findDeviceByRecoveryCode(code: string): Promise<DailyDeviceRow | null>;
  getPuzzle(gameId: string, puzzleDate: string): Promise<DailyPuzzleRow | null>;
  listArchivePuzzles(gameId: string, beforeDate: string, limit: number): Promise<DailyPuzzleRow[]>;
  getAttempt(deviceId: string, puzzleId: string): Promise<DailyAttemptRow | null>;
  upsertAttempt(row: DailyAttemptRow): Promise<void>;
  listAttemptsForStreak(deviceId: string, gameId: string, limit: number): Promise<StreakRow[]>;
  getQueueStatus(gameId: string, fromDate?: string): Promise<{ queuedFutureDays: number }>;
  /**
   * Every puzzle for a game, newest first, regardless of status.
   *
   * Backs both "which dates are already taken" and the content digest used to
   * guarantee a puzzle is never shipped twice. Callers must not hand these rows
   * to a content generator — they carry answer keys.
   */
  listPuzzles(gameId: string, limit: number): Promise<DailyPuzzleRow[]>;
  insertPack(pack: DailyContentPack, status: "draft" | "queued", factCheck: unknown): Promise<void>;
  listDraftPacks(gameId?: string): Promise<DailyPuzzleRow[]>;
  decideDraftPack(id: string, approve: boolean): Promise<void>;
}
