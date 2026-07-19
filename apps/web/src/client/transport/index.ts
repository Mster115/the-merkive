import type { RoomTransport } from "./types";
import { sseTransport } from "./sse";
import { supabaseTransport } from "./supabase";
import { partykitTransport } from "./partykit";

export type { RoomTransport, TransportOptions, TransportStatus } from "./types";

export function getTransport(): RoomTransport {
  const mode =
    process.env.NEXT_PUBLIC_MB_MODE ??
    (process.env.NEXT_PUBLIC_PARTYKIT_HOST
      ? "partykit"
      : process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "supabase"
      : "memory");
  
  if (mode === "partykit") return partykitTransport;
  if (mode === "supabase") return supabaseTransport;
  return sseTransport;
}
