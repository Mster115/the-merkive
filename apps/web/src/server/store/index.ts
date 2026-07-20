import type { RoomStore } from "./types";
import { MemoryStore } from "./memory";
import { PartyKitStore } from "./partykit";
import { UpstashStore } from "./upstash";

declare global {
  // eslint-disable-next-line no-var
  var __mbStore: RoomStore | undefined;
}

export function getStore(): RoomStore {
  if (!globalThis.__mbStore) {
    const upstashUrl =
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.KV_REST_API_URL ||
      process.env.REDIS_REST_API_URL;
    const upstashToken =
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.KV_REST_API_TOKEN ||
      process.env.REDIS_REST_API_TOKEN;
    const usePartyKit = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST;

    if (upstashUrl && upstashToken && process.env.MB_MODE !== "memory") {
      globalThis.__mbStore = new UpstashStore(upstashUrl, upstashToken);
    } else if (usePartyKit && process.env.MB_MODE !== "memory") {
      globalThis.__mbStore = new PartyKitStore();
    } else {
      globalThis.__mbStore = new MemoryStore();
    }
  }
  return globalThis.__mbStore;
}
