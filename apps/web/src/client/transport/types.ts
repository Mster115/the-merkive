import type { RoomMessage } from "@/shared/messages";

export type TransportStatus = "connecting" | "open" | "closed";

export interface TransportOptions {
  code: string;
  token: string | null;
  /** Passive shared display (the Stage) — never resumes a seat's identity or reports its presence. */
  viewerOnly?: boolean;
  onMessage: (msg: RoomMessage | { kind: "hello"; serverNow: number }) => void;
  onStatus: (status: TransportStatus) => void;
}

/** Returns a disconnect function. Implementations must auto-reconnect. */
export type RoomTransport = (opts: TransportOptions) => () => void;
