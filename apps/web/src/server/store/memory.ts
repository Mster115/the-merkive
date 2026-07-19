import type { RoomMessage } from "@/shared/messages";
import type {
  CustomPackRecord,
  MatchRecord,
  MatchUpdate,
  PlayerSeatRecord,
  RoomRecord,
  RoomStore,
  SpectatorRecord,
} from "./types";
import type { SeatIndex } from "@merky/game-sdk";

interface MemoryDb {
  rooms: Map<string, RoomRecord>; // by id
  roomIdByCode: Map<string, string>;
  seats: Map<string, PlayerSeatRecord[]>; // by roomId
  spectators: Map<string, SpectatorRecord[]>; // by roomId
  matches: Map<string, MatchRecord>; // by id
  activeMatchByRoom: Map<string, string>;
  eventSeq: Map<string, number>; // by matchId
  packs: CustomPackRecord[];
  subscribers: Map<string, Set<(msg: RoomMessage) => void>>; // by room code
}

function createDb(): MemoryDb {
  return {
    rooms: new Map(),
    roomIdByCode: new Map(),
    seats: new Map(),
    spectators: new Map(),
    matches: new Map(),
    activeMatchByRoom: new Map(),
    eventSeq: new Map(),
    packs: [],
    subscribers: new Map(),
  };
}

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryStore implements RoomStore {
  readonly kind = "memory" as const;
  private db: MemoryDb;

  constructor() {
    this.db = createDb();
  }

  async createRoom(room: RoomRecord): Promise<void> {
    this.db.rooms.set(room.id, clone(room));
    this.db.roomIdByCode.set(room.code, room.id);
    this.db.seats.set(room.id, []);
    this.db.spectators.set(room.id, []);
  }

  async getRoomByCode(code: string): Promise<RoomRecord | null> {
    const id = this.db.roomIdByCode.get(code.toUpperCase());
    return id ? clone(this.db.rooms.get(id) ?? null) : null;
  }

  async getRoomById(roomId: string): Promise<RoomRecord | null> {
    return clone(this.db.rooms.get(roomId) ?? null);
  }

  async updateRoom(roomId: string, patch: Partial<RoomRecord>): Promise<void> {
    const room = this.db.rooms.get(roomId);
    if (!room) return;
    Object.assign(room, clone(patch), { updatedAt: Date.now() });
  }

  async listActiveRooms(): Promise<RoomRecord[]> {
    return [...this.db.rooms.values()].filter((r) => r.status !== "expired").map(clone);
  }

  async deleteRoom(roomId: string): Promise<void> {
    const room = this.db.rooms.get(roomId);
    if (!room) return;
    this.db.rooms.delete(roomId);
    this.db.roomIdByCode.delete(room.code);
    this.db.seats.delete(roomId);
    this.db.spectators.delete(roomId);
    const matchId = this.db.activeMatchByRoom.get(roomId);
    if (matchId) this.db.activeMatchByRoom.delete(roomId);
    for (const [id, m] of this.db.matches) {
      if (m.roomId === roomId) this.db.matches.delete(id);
    }
  }

  async listSeats(roomId: string): Promise<PlayerSeatRecord[]> {
    return clone(this.db.seats.get(roomId) ?? []).sort((a, b) => a.seatIndex - b.seatIndex);
  }

  async upsertSeat(seat: PlayerSeatRecord): Promise<void> {
    const seats = this.db.seats.get(seat.roomId) ?? [];
    const i = seats.findIndex((s) => s.seatIndex === seat.seatIndex);
    if (i >= 0) seats[i] = clone(seat);
    else seats.push(clone(seat));
    this.db.seats.set(seat.roomId, seats);
  }

  async updateSeat(
    roomId: string,
    seatIndex: SeatIndex,
    patch: Partial<PlayerSeatRecord>
  ): Promise<void> {
    const seat = (this.db.seats.get(roomId) ?? []).find((s) => s.seatIndex === seatIndex);
    if (seat) Object.assign(seat, clone(patch));
  }

  async removeSeat(roomId: string, seatIndex: SeatIndex): Promise<void> {
    const seats = this.db.seats.get(roomId) ?? [];
    this.db.seats.set(
      roomId,
      seats.filter((s) => s.seatIndex !== seatIndex)
    );
  }

  async listSpectators(roomId: string): Promise<SpectatorRecord[]> {
    return clone(this.db.spectators.get(roomId) ?? []);
  }

  async upsertSpectator(spectator: SpectatorRecord): Promise<void> {
    const list = this.db.spectators.get(spectator.roomId) ?? [];
    const i = list.findIndex((s) => s.uid === spectator.uid);
    if (i >= 0) list[i] = clone(spectator);
    else list.push(clone(spectator));
    this.db.spectators.set(spectator.roomId, list);
  }

  async removeSpectator(roomId: string, uid: string): Promise<void> {
    const list = this.db.spectators.get(roomId) ?? [];
    this.db.spectators.set(
      roomId,
      list.filter((s) => s.uid !== uid)
    );
  }

  async createMatch(match: MatchRecord): Promise<void> {
    this.db.matches.set(match.id, clone(match));
    this.db.activeMatchByRoom.set(match.roomId, match.id);
    this.db.eventSeq.set(match.id, 0);
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    return clone(this.db.matches.get(matchId) ?? null);
  }

  async getActiveMatch(roomId: string): Promise<MatchRecord | null> {
    const id = this.db.activeMatchByRoom.get(roomId);
    if (!id) return null;
    const m = this.db.matches.get(id);
    return m && m.status === "active" ? clone(m) : null;
  }

  async applyMatchUpdate(
    matchId: string,
    expectedVersion: number,
    update: MatchUpdate
  ): Promise<"ok" | "conflict"> {
    const m = this.db.matches.get(matchId);
    if (!m || m.version !== expectedVersion) return "conflict";
    m.version = update.version;
    m.phase = update.phase;
    m.publicState = clone(update.publicState);
    if (update.privateStatePatch) {
      m.privateState = { ...m.privateState, ...clone(update.privateStatePatch) };
    }
    if (update.scoresPatch) {
      m.scores = { ...m.scores, ...clone(update.scoresPatch) };
    }
    if (update.timer !== undefined) m.timer = clone(update.timer);
    if (update.over) m.over = true;
    if (update.status) {
      m.status = update.status;
      if (update.status !== "active") this.db.activeMatchByRoom.delete(m.roomId);
    }
    if (update.endedAt !== undefined) m.endedAt = update.endedAt;
    const seq = this.db.eventSeq.get(matchId) ?? 0;
    this.db.eventSeq.set(matchId, seq + update.events.length);
    return "ok";
  }

  async listCustomPacks(gameId: string): Promise<CustomPackRecord[]> {
    return clone(this.db.packs.filter((p) => p.gameId === gameId));
  }

  async createCustomPack(pack: CustomPackRecord): Promise<void> {
    this.db.packs.push(clone(pack));
  }

  async publish(code: string, msg: RoomMessage): Promise<void> {
    const partyHost = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (partyHost) {
      const protocol =
        partyHost.startsWith("localhost") || partyHost.startsWith("127.0.0.1") ? "http" : "https";
      const url = `${protocol}://${partyHost}/parties/room/${code}`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg }),
      }).catch((err) => {
        console.error("PartyKit relay error:", err);
      });
      return;
    }

    const subs = this.db.subscribers.get(code.toUpperCase());
    if (!subs) return;
    const frozen = clone(msg);
    for (const fn of subs) {
      try {
        fn(frozen);
      } catch {
        // subscriber errors must never break the publisher
      }
    }
  }

  subscribe(code: string, fn: (msg: RoomMessage) => void): () => void {
    const key = code.toUpperCase();
    const subs = this.db.subscribers.get(key) ?? new Set();
    subs.add(fn);
    this.db.subscribers.set(key, subs);
    return () => {
      subs.delete(fn);
      if (subs.size === 0) this.db.subscribers.delete(key);
    };
  }
}
