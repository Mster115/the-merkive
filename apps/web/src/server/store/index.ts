import type { RoomStore } from "./types";
import { MemoryStore } from "./memory";
import { PartyKitStore } from "./partykit";

declare global {
  // eslint-disable-next-line no-var
  var __mbStore: RoomStore | undefined;
}

export function getStore(): RoomStore {
  if (!globalThis.__mbStore) {
    const usePartyKit = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    globalThis.__mbStore = (usePartyKit && process.env.MB_MODE !== "memory") ? new PartyKitStore() : new MemoryStore();
  }
  return globalThis.__mbStore;
}
