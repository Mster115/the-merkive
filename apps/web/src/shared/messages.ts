import type { GameEvent, MatchView, RoomView, SeatIndex } from "@merky/game-sdk";

/**
 * Realtime fanout contract, identical across transports.
 * Memory mode: one SSE stream per client; the server filters per connection.
 * Supabase mode: "room"/"match"/broadcast "bye" go to the room's public
 * channel; "private"/targeted "bye" go to the seat channel.
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
