import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyPuzzleRow, DailyDeviceRow, DailyAttemptRow } from "@merky/db";
import type { DailyContentPack } from "@merky/games/daily/types";
import type { DailyStore } from "./types";
import type { StreakRow } from "../streaks";

export class SupabaseDailyStore implements DailyStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async upsertDevice(id: string, timezone: string): Promise<void> {
    const { error } = await this.client.from("daily_devices").upsert(
      {
        id,
        timezone,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`[SupabaseDailyStore] upsertDevice failed: ${error.message}`);
  }

  async getDevice(id: string): Promise<DailyDeviceRow | null> {
    const { data, error } = await this.client
      .from("daily_devices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`[SupabaseDailyStore] getDevice failed: ${error.message}`);
    return data as DailyDeviceRow | null;
  }

  async setRecoveryCode(deviceId: string, code: string): Promise<void> {
    const { error } = await this.client
      .from("daily_devices")
      .update({ recovery_code: code })
      .eq("id", deviceId);

    if (error) throw new Error(`[SupabaseDailyStore] setRecoveryCode failed: ${error.message}`);
  }

  async findDeviceByRecoveryCode(code: string): Promise<DailyDeviceRow | null> {
    const { data, error } = await this.client
      .from("daily_devices")
      .select("*")
      .eq("recovery_code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`[SupabaseDailyStore] findDeviceByRecoveryCode failed: ${error.message}`);
    }
    return data as DailyDeviceRow | null;
  }

  async getPuzzle(gameId: string, puzzleDate: string): Promise<DailyPuzzleRow | null> {
    const { data, error } = await this.client
      .from("daily_puzzles")
      .select("*")
      .eq("game_id", gameId)
      .eq("puzzle_date", puzzleDate)
      .eq("status", "queued")
      .maybeSingle();

    if (error) throw new Error(`[SupabaseDailyStore] getPuzzle failed: ${error.message}`);
    return data as DailyPuzzleRow | null;
  }

  async listArchivePuzzles(
    gameId: string,
    beforeDate: string,
    limit: number
  ): Promise<DailyPuzzleRow[]> {
    const { data, error } = await this.client
      .from("daily_puzzles")
      .select("*")
      .eq("game_id", gameId)
      .eq("status", "queued")
      .lt("puzzle_date", beforeDate)
      .order("puzzle_date", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`[SupabaseDailyStore] listArchivePuzzles failed: ${error.message}`);
    return (data as DailyPuzzleRow[]) ?? [];
  }

  async getAttempt(deviceId: string, puzzleId: string): Promise<DailyAttemptRow | null> {
    const { data, error } = await this.client
      .from("daily_attempts")
      .select("*")
      .eq("device_id", deviceId)
      .eq("puzzle_id", puzzleId)
      .maybeSingle();

    if (error) throw new Error(`[SupabaseDailyStore] getAttempt failed: ${error.message}`);
    return data as DailyAttemptRow | null;
  }

  async upsertAttempt(row: DailyAttemptRow): Promise<void> {
    const { error } = await this.client
      .from("daily_attempts")
      .upsert(row, { onConflict: "device_id,puzzle_id" });

    if (error) throw new Error(`[SupabaseDailyStore] upsertAttempt failed: ${error.message}`);
  }

  async listAttemptsForStreak(
    deviceId: string,
    gameId: string,
    limit: number
  ): Promise<StreakRow[]> {
    const { data, error } = await this.client
      .from("daily_attempts")
      .select("puzzle_date, status, on_time")
      .eq("device_id", deviceId)
      .eq("game_id", gameId)
      .order("puzzle_date", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`[SupabaseDailyStore] listAttemptsForStreak failed: ${error.message}`);
    return (data as Array<{ puzzle_date: string; status: string; on_time: boolean }>)?.map((a) => ({
      puzzleDate: a.puzzle_date,
      status: a.status,
      onTime: a.on_time,
    })) ?? [];
  }

  async getQueueStatus(gameId: string, fromDate?: string): Promise<{ queuedFutureDays: number }> {
    const today = fromDate ?? new Date().toISOString().slice(0, 10);
    const { count, error } = await this.client
      .from("daily_puzzles")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("status", "queued")
      .gte("puzzle_date", today);

    if (error) throw new Error(`[SupabaseDailyStore] getQueueStatus failed: ${error.message}`);
    return { queuedFutureDays: count ?? 0 };
  }

  async listPuzzles(gameId: string, limit: number): Promise<DailyPuzzleRow[]> {
    const { data, error } = await this.client
      .from("daily_puzzles")
      .select("*")
      .eq("game_id", gameId)
      .order("puzzle_date", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`[SupabaseDailyStore] listPuzzles failed: ${error.message}`);
    return (data as DailyPuzzleRow[]) ?? [];
  }

  async insertPack(
    pack: DailyContentPack,
    status: "draft" | "queued",
    factCheck: unknown
  ): Promise<void> {
    const { error } = await this.client.from("daily_puzzles").upsert(
      {
        game_id: pack.gameId,
        puzzle_date: pack.puzzleDate,
        status,
        payload: pack.payload,
        source_refs: pack.sourceRefs,
        fact_check: factCheck ?? null,
        generated_by: "pipeline",
      },
      { onConflict: "game_id,puzzle_date" }
    );

    if (error) throw new Error(`[SupabaseDailyStore] insertPack failed: ${error.message}`);
  }

  async listDraftPacks(gameId?: string): Promise<DailyPuzzleRow[]> {
    let query = this.client.from("daily_puzzles").select("*").eq("status", "draft");
    if (gameId) {
      query = query.eq("game_id", gameId);
    }
    const { data, error } = await query.order("puzzle_date", { ascending: false });

    if (error) throw new Error(`[SupabaseDailyStore] listDraftPacks failed: ${error.message}`);
    return (data as DailyPuzzleRow[]) ?? [];
  }

  async decideDraftPack(id: string, approve: boolean): Promise<void> {
    if (approve) {
      const { error } = await this.client
        .from("daily_puzzles")
        .update({ status: "queued" })
        .eq("id", id);
      if (error) throw new Error(`[SupabaseDailyStore] decideDraftPack approve failed: ${error.message}`);
    } else {
      const { error } = await this.client.from("daily_puzzles").delete().eq("id", id);
      if (error) throw new Error(`[SupabaseDailyStore] decideDraftPack reject failed: ${error.message}`);
    }
  }
}
