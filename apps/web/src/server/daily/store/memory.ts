import type { DailyPuzzleRow, DailyDeviceRow, DailyAttemptRow } from "@merky/db";
import type { DailyContentPack } from "@merky/games/daily/types";
import type { DailyStore } from "./types";
import type { StreakRow } from "../streaks";

export class MemoryDailyStore implements DailyStore {
  readonly kind = "memory" as const;

  private devices = new Map<string, DailyDeviceRow>();
  private puzzles = new Map<string, DailyPuzzleRow>();
  private attempts = new Map<string, DailyAttemptRow>();

  async upsertDevice(id: string, timezone: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = this.devices.get(id);
    if (existing) {
      existing.timezone = timezone;
      existing.last_seen_at = now;
    } else {
      this.devices.set(id, {
        id,
        timezone,
        created_at: now,
        last_seen_at: now,
        recovery_code: null,
      });
    }
  }

  async getPuzzle(gameId: string, puzzleDate: string): Promise<DailyPuzzleRow | null> {
    for (const p of this.puzzles.values()) {
      if (p.game_id === gameId && p.puzzle_date === puzzleDate && p.status === "queued") {
        return p;
      }
    }
    return null;
  }

  async listArchivePuzzles(
    gameId: string,
    beforeDate: string,
    limit: number
  ): Promise<DailyPuzzleRow[]> {
    const result: DailyPuzzleRow[] = [];
    for (const p of this.puzzles.values()) {
      if (p.game_id === gameId && p.status === "queued" && p.puzzle_date < beforeDate) {
        result.push(p);
      }
    }
    result.sort((a, b) => b.puzzle_date.localeCompare(a.puzzle_date));
    return result.slice(0, limit);
  }

  async getAttempt(deviceId: string, puzzleId: string): Promise<DailyAttemptRow | null> {
    const key = `${deviceId}:${puzzleId}`;
    return this.attempts.get(key) ?? null;
  }

  async upsertAttempt(row: DailyAttemptRow): Promise<void> {
    const key = `${row.device_id}:${row.puzzle_id}`;
    this.attempts.set(key, { ...row, updated_at: new Date().toISOString() });
  }

  async listAttemptsForStreak(
    deviceId: string,
    gameId: string,
    limit: number
  ): Promise<StreakRow[]> {
    const matches: DailyAttemptRow[] = [];
    for (const a of this.attempts.values()) {
      if (a.device_id === deviceId && a.game_id === gameId) {
        matches.push(a);
      }
    }
    matches.sort((a, b) => b.puzzle_date.localeCompare(a.puzzle_date));
    return matches.slice(0, limit).map((a) => ({
      puzzleDate: a.puzzle_date,
      status: a.status,
      onTime: a.on_time,
    }));
  }

  async getQueueStatus(gameId: string, fromDate?: string): Promise<{ queuedFutureDays: number }> {
    const today = fromDate ?? new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const p of this.puzzles.values()) {
      if (p.game_id === gameId && p.status === "queued" && p.puzzle_date >= today) {
        count += 1;
      }
    }
    return { queuedFutureDays: count };
  }

  async insertPack(
    pack: DailyContentPack,
    status: "draft" | "queued",
    factCheck: unknown
  ): Promise<void> {
    // Check for existing puzzle with same game_id and puzzle_date
    let existingId: string | null = null;
    for (const p of this.puzzles.values()) {
      if (p.game_id === pack.gameId && p.puzzle_date === pack.puzzleDate) {
        existingId = p.id;
        break;
      }
    }

    const id = existingId ?? crypto.randomUUID();
    const row: DailyPuzzleRow = {
      id,
      game_id: pack.gameId,
      puzzle_date: pack.puzzleDate,
      status,
      payload: pack.payload,
      source_refs: pack.sourceRefs,
      fact_check: factCheck ?? null,
      generated_by: "pipeline",
      created_at: new Date().toISOString(),
    };
    this.puzzles.set(id, row);
  }

  async listDraftPacks(gameId?: string): Promise<DailyPuzzleRow[]> {
    const drafts: DailyPuzzleRow[] = [];
    for (const p of this.puzzles.values()) {
      if (p.status === "draft" && (!gameId || p.game_id === gameId)) {
        drafts.push(p);
      }
    }
    drafts.sort((a, b) => b.puzzle_date.localeCompare(a.puzzle_date));
    return drafts;
  }

  async decideDraftPack(id: string, approve: boolean): Promise<void> {
    const puzzle = this.puzzles.get(id);
    if (!puzzle) return;
    if (approve) {
      puzzle.status = "queued";
    } else {
      this.puzzles.delete(id);
    }
  }
}
