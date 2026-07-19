import type { RoomMessage } from "@/shared/messages";

export type TransportStatus = "connecting" | "open" | "closed";

export interface TransportOptions {
  code: string;
  token: string | null;
  onMessage: (msg: RoomMessage | { kind: "hello"; serverNow: number }) => void;
  onStatus: (status: TransportStatus) => void;
}

/** Returns a disconnect function. Implementations must auto-reconnect. */
export type RoomTransport = (opts: TransportOptions) => () => void;
