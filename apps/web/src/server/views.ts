import type {
  GameContext,
  MatchView,
  RoomView,
  SeatIndex,
  SeatPublic,
} from "@merky/game-sdk";
import { matchRng } from "@merky/game-sdk";
import type { ClientSnapshot } from "@/shared/messages";
import type { MatchRecord, PlayerSeatRecord, RoomRecord } from "./store/types";

export function seatPublic(seat: PlayerSeatRecord, hostSeat: SeatIndex | null): SeatPublic {
  return {
    seatIndex: seat.seatIndex,
    displayName: seat.displayName,
    avatarId: seat.avatarId,
    role: "player",
    connected: seat.connected,
    abandoned: seat.abandoned,
    isHost: hostSeat === seat.seatIndex,
  };
}

export function roomView(
  room: RoomRecord,
  seats: PlayerSeatRecord[],
  spectatorCount: number
): RoomView {
  return {
    code: room.code,
    status: room.status,
    hostSeat: room.hostSeat,
    gameId: room.gameId,
    settings: room.settings,
    maxPlayers: room.maxPlayers,
    seats: seats.map((s) => seatPublic(s, room.hostSeat)),
    spectatorCount,
    lastMatch: room.lastMatch,
  };
}

export function matchView(m: MatchRecord): MatchView {
  return {
    id: m.id,
    gameId: m.gameId,
    phase: m.phase,
    publicState: m.publicState,
    settings: m.settings,
    scores: m.scores,
    timer: m.timer,
    version: m.version,
    over: m.over,
  };
}

export function buildCtx(
  room: RoomRecord,
  match: MatchRecord,
  seats: PlayerSeatRecord[]
): GameContext {
  return {
    matchId: match.id,
    roomId: room.id,
    seats: seats.map((s) => seatPublic(s, room.hostSeat)),
    settings: match.settings,
    now: Date.now(),
    rng: matchRng(match.seed, match.version),
  };
}

export function buildSnapshot(
  room: RoomRecord,
  seats: PlayerSeatRecord[],
  spectatorCount: number,
  match: MatchRecord | null,
  you: { seatIndex: SeatIndex | null; role: "player" | "spectator" }
): ClientSnapshot {
  return {
    room: roomView(room, seats, spectatorCount),
    match: match ? matchView(match) : null,
    you: {
      seatIndex: you.seatIndex,
      role: you.role,
      privateState:
        match && you.seatIndex !== null ? (match.privateState[you.seatIndex] ?? null) : null,
    },
    serverNow: Date.now(),
  };
}
