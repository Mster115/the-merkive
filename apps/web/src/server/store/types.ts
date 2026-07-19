import type { GameEvent, SeatIndex, TimerInfo } from "@merky/game-sdk";
import type { RoomMessage } from "@/shared/messages";

export type RoomStatus = "lobby" | "in_game" | "ended" | "expired";

export interface LastMatchSummary {
  gameId: string;
  endedAt: number;
  scores: Partial<Record<SeatIndex, number>>;
  seats: { seatIndex: SeatIndex; displayName: string; avatarId: string }[];
}

export interface RoomRecord {
  id: string;
  code: string;
  status: RoomStatus;
  hostSeat: SeatIndex | null;
  gameId: string | null;
  settings: Record<string, unknown>;
  maxPlayers: number;
  createdAt: number;
  updatedAt: number;
  /** Absolute lifetime deadline (epoch ms). */
  expiresAt: number;
  /** Set when every player disconnects mid-match; cleared on reconnect. */
  pausedAt: number | null;
  lastMatch: LastMatchSummary | null;
}

export interface PlayerSeatRecord {
  roomId: string;
  seatIndex: SeatIndex;
  playerUid: string;
  displayName: string;
  avatarId: string;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
  disconnectedAt: number | null;
  abandoned: boolean;
}

export interface SpectatorRecord {
  roomId: string;
  uid: string;
  displayName: string;
  avatarId: string;
  connected: boolean;
  lastSeenAt: number;
}

export interface MatchRecord {
  id: string;
  roomId: string;
  gameId: string;
  status: "active" | "completed" | "aborted";
  phase: string;
  seed: string;
  /** Starts at 0; each applied ReduceResult bumps it by exactly 1. */
  version: number;
  settings: Record<string, unknown>;
  publicState: unknown;
  privateState: Partial<Record<SeatIndex, unknown>>;
  scores: Partial<Record<SeatIndex, number>>;
  timer: TimerInfo | null;
  over: boolean;
  startedAt: number;
  endedAt: number | null;
}

export interface CustomPackRecord {
  id: string;
  gameId: string;
  title: string;
  locale: string;
  payload: unknown;
  createdAt: number;
}

/** Persisted result of one applied ReduceResult, written atomically with a version CAS. */
export interface MatchUpdate {
  /** New version (must be expectedVersion + 1). */
  version: number;
  phase: string;
  publicState: unknown;
  privateStatePatch?: Partial<Record<SeatIndex, unknown>>;
  scoresPatch?: Partial<Record<SeatIndex, number>>;
  /** undefined = keep current timer; null = clear. */
  timer?: TimerInfo | null;
  over?: boolean;
  status?: MatchRecord["status"];
  endedAt?: number | null;
  events: GameEvent[];
  actorSeat: SeatIndex | "system";
}

/**
 * Persistence + fanout adapter. Implementations: MemoryStore (single-process
 * dev; SSE fanout) and SupabaseStore (Postgres truth; Supabase Realtime fanout).
 * Contains no game or lifecycle logic — that lives in the service layer.
 */
export interface RoomStore {
  readonly kind: "memory" | "partykit";

  createRoom(room: RoomRecord): Promise<void>;
  getRoomByCode(code: string): Promise<RoomRecord | null>;
  getRoomById(roomId: string): Promise<RoomRecord | null>;
  updateRoom(roomId: string, patch: Partial<RoomRecord>): Promise<void>;
  /** Rooms not yet expired — the sweeper's working set. */
  listActiveRooms(): Promise<RoomRecord[]>;
  deleteRoom(roomId: string): Promise<void>;

  listSeats(roomId: string): Promise<PlayerSeatRecord[]>;
  upsertSeat(seat: PlayerSeatRecord): Promise<void>;
  updateSeat(roomId: string, seatIndex: SeatIndex, patch: Partial<PlayerSeatRecord>): Promise<void>;
  removeSeat(roomId: string, seatIndex: SeatIndex): Promise<void>;

  listSpectators(roomId: string): Promise<SpectatorRecord[]>;
  upsertSpectator(spectator: SpectatorRecord): Promise<void>;
  removeSpectator(roomId: string, uid: string): Promise<void>;

  createMatch(match: MatchRecord, initialEvents: GameEvent[]): Promise<void>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  getActiveMatch(roomId: string): Promise<MatchRecord | null>;
  /**
   * Atomically: verify match.version === expectedVersion, apply the update
   * (merge private/scores patches, append events), bump version. Returns
   * "conflict" without writing anything if the version check fails.
   */
  applyMatchUpdate(
    matchId: string,
    expectedVersion: number,
    update: MatchUpdate
  ): Promise<"ok" | "conflict">;

  listCustomPacks(gameId: string): Promise<CustomPackRecord[]>;
  createCustomPack(pack: CustomPackRecord): Promise<void>;

  /** Fan a message out to the room's subscribers. */
  publish(code: string, msg: RoomMessage): Promise<void>;
  /** Memory transport only (SSE); Supabase clients subscribe directly to Realtime. */
  subscribe?(code: string, fn: (msg: RoomMessage) => void): () => void;
}
