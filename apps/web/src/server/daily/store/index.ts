import type { DailyStore } from "./types";
import { MemoryDailyStore } from "./memory";
import { SupabaseDailyStore } from "./supabase";

let globalStore: DailyStore | null = null;

export function getDailyStore(): DailyStore {
  if (globalStore) return globalStore;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    globalStore = new SupabaseDailyStore(url, key);
    return globalStore;
  }

  // The in-memory store is per-process and does not survive a cold start, so
  // in production it does not "degrade gracefully" — every puzzle, attempt and
  // streak silently vanishes and /daily just looks permanently empty. That
  // reads as "the feature is broken" rather than "the deploy is misconfigured",
  // so refuse instead of guessing. Locally it stays the default, which is what
  // makes the feature runnable without Supabase credentials.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[daily] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production. " +
        "Refusing to fall back to the in-memory daily store, which loses all " +
        "puzzles, attempts and streaks on every cold start."
    );
  }

  globalStore = new MemoryDailyStore();
  return globalStore;
}

/** Reset global store instance (useful for test suites) */
export function resetDailyStore(override?: DailyStore): void {
  globalStore = override ?? null;
}
