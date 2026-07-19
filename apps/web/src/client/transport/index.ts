import type { RoomTransport } from "./types";
import { sseTransport } from "./sse";
import { partykitTransport } from "./partykit";

export type { RoomTransport, TransportOptions, TransportStatus } from "./types";

export function getTransport(): RoomTransport {
  const mode =
    process.env.NEXT_PUBLIC_MB_MODE ??
    (process.env.NEXT_PUBLIC_PARTYKIT_HOST ? "partykit" : "memory");
  
  if (mode === "partykit") return partykitTransport;
  return sseTransport;
}
