import type { RoomMessage } from "@/shared/messages";

export type TransportStatus = "connecting" | "open" | "closed";

export interface TransportOptions {
  code: string;
  token: string | null;
  /**
   * This client's own seat, once known. Lets the relay target private
   * messages without resolving the token against a seat table it may not
   * have — with Upstash as the store, the PartyKit store DO is never
   * populated, so a token-only lookup finds nothing.
   */
  seatIndex?: number | null;
  /** Passive shared display (the Stage) — never resumes a seat's identity or reports its presence. */
  viewerOnly?: boolean;
  onMessage: (msg: RoomMessage | { kind: "hello"; serverNow: number }) => void;
  onStatus: (status: TransportStatus) => void;
}

/** Returns a disconnect function. Implementations must auto-reconnect. */
export type RoomTransport = (opts: TransportOptions) => () => void;
