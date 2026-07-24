import type { DailyPuzzleRow, DailyDeviceRow, DailyAttemptRow } from "@merky/db";
import type { DailyContentPack } from "@merky/games/daily/types";
import type { StreakRow } from "../streaks";

export interface DailyStore {
  readonly kind: "memory" | "supabase";
  upsertDevice(id: string, timezone: string): Promise<void>;
  getPuzzle(gameId: string, puzzleDate: string): Promise<DailyPuzzleRow | null>;
  listArchivePuzzles(gameId: string, beforeDate: string, limit: number): Promise<DailyPuzzleRow[]>;
  getAttempt(deviceId: string, puzzleId: string): Promise<DailyAttemptRow | null>;
  upsertAttempt(row: DailyAttemptRow): Promise<void>;
  listAttemptsForStreak(deviceId: string, gameId: string, limit: number): Promise<StreakRow[]>;
  getQueueStatus(gameId: string, fromDate?: string): Promise<{ queuedFutureDays: number }>;
  insertPack(pack: DailyContentPack, status: "draft" | "queued", factCheck: unknown): Promise<void>;
  listDraftPacks(gameId?: string): Promise<DailyPuzzleRow[]>;
  decideDraftPack(id: string, approve: boolean): Promise<void>;
}
