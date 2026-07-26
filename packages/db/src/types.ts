export type DailyPuzzleStatus = "draft" | "queued";

export interface DailyPuzzleRow {
  id: string;
  game_id: string;
  puzzle_date: string;
  status: DailyPuzzleStatus;
  payload: unknown;
  source_refs: { url: string; title: string }[];
  fact_check: unknown | null;
  generated_by: string;
  created_at: string;
}

export interface DailyDeviceRow {
  id: string;
  timezone: string;
  created_at: string;
  last_seen_at: string;
  recovery_code: string | null;
  /**
   * Game ids whose how-to-play modal this device has already been shown.
   * Optional because rows written before migration 0002 do not carry it.
   */
  seen_howto?: string[];
}

export interface DailyAttemptRow {
  id: string;
  device_id: string;
  puzzle_id: string;
  game_id: string;
  puzzle_date: string;
  phase: string;
  public_state: unknown;
  secret_state: unknown;
  version: number;
  status: string; // "in_progress" | "solved" | "failed"
  /** True only when completed on puzzle_date itself; false for archive catch-up. */
  on_time: boolean;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  score: number | null;
  share_text: string | null;
  updated_at: string;
}
