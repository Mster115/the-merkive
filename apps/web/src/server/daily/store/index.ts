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
  } else {
    globalStore = new MemoryDailyStore();
  }

  return globalStore;
}

/** Reset global store instance (useful for test suites) */
export function resetDailyStore(override?: DailyStore): void {
  globalStore = override ?? null;
}
