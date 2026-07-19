import type { GameEvent, MatchView, RoomView, SeatIndex } from "@merky/game-sdk";

/**
 * Realtime fanout contract, identical across transports.
 * Memory mode: SSE stream per client.
 * PartyKit mode: WebSocket connection per client.
 */
export type RoomMessage =
  | { kind: "room"; room: RoomView }
  | { kind: "match"; match: MatchView; events: GameEvent[] }
  | { kind: "private"; seat: SeatIndex; version: number; privateState: unknown }
  | { kind: "bye"; reason: "expired" | "kicked" | "room_closed"; seat?: SeatIndex };

export interface ClientSnapshot {
  room: RoomView;
  match: MatchView | null;
  you: {
    seatIndex: SeatIndex | null;
    role: "player" | "spectator";
    privateState: unknown;
  };
  serverNow: number;
}

export interface JoinResponse {
  token: string;
  snapshot: ClientSnapshot;
}

export type ApiError = { error: string; code: string };

export const TICK_ACTION = "__tick__";
