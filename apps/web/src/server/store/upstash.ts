import type { SeatIndex } from "@merky/game-sdk";
import type { RoomMessage } from "@/shared/messages";
import type {
  CustomPackRecord,
  MatchRecord,
  MatchUpdate,
  PlayerSeatRecord,
  RoomLogSlice,
  RoomRecord,
  RoomStore,
  SpectatorRecord,
} from "./types";

/**
 * How long a room's realtime message log outlives its last publish. Every
 * publish refreshes it, so this only ever reaps logs for dead rooms.
 */
const LOG_TTL_SECONDS = 6 * 60 * 60;

export class UpstashStore implements RoomStore {
  readonly kind = "upstash" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  private async redis<T>(command: (string | number)[]): Promise<T> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Upstash error ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as { result: T };
    return json.result;
  }

  /** Several commands, one round trip. Returns each command's result in order. */
  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Upstash error ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as { result?: unknown; error?: string }[];
    return json.map((entry) => entry.result);
  }

  async createRoom(room: RoomRecord): Promise<void> {
    const json = JSON.stringify(room);
    await Promise.all([
      this.redis(["SET", `room:id:${room.id}`, json]),
      this.redis(["SET", `room:code:${room.code.toUpperCase()}`, room.id]),
      this.redis(["SADD", "rooms:active", room.id]),
    ]);
  }

  async getRoomByCode(code: string): Promise<RoomRecord | null> {
    const id = await this.redis<string | null>(["GET", `room:code:${code.toUpperCase()}`]);
    if (!id) return null;
    return this.getRoomById(id);
  }

  async getRoomById(roomId: string): Promise<RoomRecord | null> {
    const raw = await this.redis<string | null>(["GET", `room:id:${roomId}`]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RoomRecord;
    } catch {
      return null;
    }
  }

  async updateRoom(roomId: string, patch: Partial<RoomRecord>): Promise<void> {
    const room = await this.getRoomById(roomId);
    if (!room) return;
    const updated: RoomRecord = { ...room, ...patch, updatedAt: Date.now() };
    await this.redis(["SET", `room:id:${roomId}`, JSON.stringify(updated)]);
    if (patch.status === "expired") {
      await this.redis(["SREM", "rooms:active", roomId]);
    }
  }

  async listActiveRooms(): Promise<RoomRecord[]> {
    const ids = await this.redis<string[] | null>(["SMEMBERS", "rooms:active"]);
    if (!ids || ids.length === 0) return [];
    const rooms = await Promise.all(ids.map((id) => this.getRoomById(id)));
    return rooms.filter((r): r is RoomRecord => r !== null && r.status !== "expired");
  }

  async deleteRoom(roomId: string): Promise<void> {
    const room = await this.getRoomById(roomId);
    const code = room?.code;
    await Promise.all([
      this.redis(["DEL", `room:id:${roomId}`]),
      code ? this.redis(["DEL", `room:code:${code.toUpperCase()}`]) : Promise.resolve(),
      this.redis(["SREM", "rooms:active", roomId]),
      this.redis(["DEL", `seats:${roomId}`]),
      this.redis(["DEL", `spectators:${roomId}`]),
      this.redis(["DEL", `match:active:${roomId}`]),
    ]);
  }

  async listSeats(roomId: string): Promise<PlayerSeatRecord[]> {
    const raw = await this.redis<Record<string, string> | null>(["HGETALL", `seats:${roomId}`]);
    if (!raw) return [];
    const seats: PlayerSeatRecord[] = [];
    const entries = Array.isArray(raw)
      ? Array.from({ length: raw.length / 2 }, (_, i) => [raw[i * 2], raw[i * 2 + 1]] as [string, string])
      : Object.entries(raw);
    for (const [, val] of entries) {
      try {
        seats.push(JSON.parse(val) as PlayerSeatRecord);
      } catch {
        // invalid JSON
      }
    }
    return seats.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  async upsertSeat(seat: PlayerSeatRecord): Promise<void> {
    await this.redis(["HSET", `seats:${seat.roomId}`, String(seat.seatIndex), JSON.stringify(seat)]);
  }

  async updateSeat(roomId: string, seatIndex: SeatIndex, patch: Partial<PlayerSeatRecord>): Promise<void> {
    const raw = await this.redis<string | null>(["HGET", `seats:${roomId}`, String(seatIndex)]);
    if (!raw) return;
    try {
      const seat = JSON.parse(raw) as PlayerSeatRecord;
      const updated: PlayerSeatRecord = { ...seat, ...patch };
      await this.upsertSeat(updated);
    } catch {
      // ignore
    }
  }

  async removeSeat(roomId: string, seatIndex: SeatIndex): Promise<void> {
    await this.redis(["HDEL", `seats:${roomId}`, String(seatIndex)]);
  }

  async listSpectators(roomId: string): Promise<SpectatorRecord[]> {
    const raw = await this.redis<Record<string, string> | null>(["HGETALL", `spectators:${roomId}`]);
    if (!raw) return [];
    const spectators: SpectatorRecord[] = [];
    const entries = Array.isArray(raw)
      ? Array.from({ length: raw.length / 2 }, (_, i) => [raw[i * 2], raw[i * 2 + 1]] as [string, string])
      : Object.entries(raw);
    for (const [, val] of entries) {
      try {
        spectators.push(JSON.parse(val) as SpectatorRecord);
      } catch {
        // ignore
      }
    }
    return spectators;
  }

  async upsertSpectator(spectator: SpectatorRecord): Promise<void> {
    await this.redis(["HSET", `spectators:${spectator.roomId}`, spectator.uid, JSON.stringify(spectator)]);
  }

  async removeSpectator(roomId: string, uid: string): Promise<void> {
    await this.redis(["HDEL", `spectators:${roomId}`, uid]);
  }

  async createMatch(match: MatchRecord): Promise<void> {
    await Promise.all([
      this.redis(["SET", `match:id:${match.id}`, JSON.stringify(match)]),
      this.redis(["SET", `match:active:${match.roomId}`, match.id]),
    ]);
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    const raw = await this.redis<string | null>(["GET", `match:id:${matchId}`]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MatchRecord;
    } catch {
      return null;
    }
  }

  async getActiveMatch(roomId: string): Promise<MatchRecord | null> {
    const matchId = await this.redis<string | null>(["GET", `match:active:${roomId}`]);
    if (!matchId) return null;
    return this.getMatch(matchId);
  }

  async applyMatchUpdate(
    matchId: string,
    expectedVersion: number,
    update: MatchUpdate
  ): Promise<"ok" | "conflict"> {
    const match = await this.getMatch(matchId);
    if (!match || match.version !== expectedVersion) return "conflict";

    const nextVersion = update.version;
    const nextPrivateState = { ...match.privateState };
    if (update.privateStatePatch) {
      for (const [s, state] of Object.entries(update.privateStatePatch)) {
        if (state !== undefined) {
          nextPrivateState[Number(s) as SeatIndex] = state;
        }
      }
    }

    const nextScores = { ...match.scores };
    if (update.scoresPatch) {
      for (const [s, score] of Object.entries(update.scoresPatch)) {
        if (score !== undefined) {
          nextScores[Number(s) as SeatIndex] = score;
        }
      }
    }

    const updatedMatch: MatchRecord = {
      ...match,
      version: nextVersion,
      phase: update.phase,
      publicState: update.publicState,
      privateState: nextPrivateState,
      secretState: update.secretState === undefined ? match.secretState : update.secretState,
      scores: nextScores,
      timer: update.timer === undefined ? match.timer : update.timer,
      over: update.over ?? match.over,
      status: update.status ?? match.status,
      endedAt: update.endedAt === undefined ? match.endedAt : update.endedAt,
    };

    await this.redis(["SET", `match:id:${matchId}`, JSON.stringify(updatedMatch)]);
    return "ok";
  }

  async listCustomPacks(gameId: string): Promise<CustomPackRecord[]> {
    const raw = await this.redis<string[] | null>(["LRANGE", `packs:${gameId}`, "0", "-1"]);
    if (!raw) return [];
    return raw.map((item) => JSON.parse(item) as CustomPackRecord);
  }

  async createCustomPack(pack: CustomPackRecord): Promise<void> {
    await this.redis(["RPUSH", `packs:${pack.gameId}`, JSON.stringify(pack)]);
  }

  private subscribers = new Map<string, Set<(msg: RoomMessage) => void>>();

  private logKey(code: string): string {
    return `room:log:${code.toUpperCase()}`;
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
    }

    const key = code.toUpperCase();
    const subs = this.subscribers.get(key);
    if (subs) {
      for (const fn of subs) {
        try {
          fn(msg);
        } catch {
          // ignore subscriber errors
        }
      }
    }

    // The durable log is what actually reaches the other instances. The
    // in-process fanout above only covers clients that happen to be streaming
    // from this very instance, which on Vercel is a small minority.
    const logKey = this.logKey(code);
    await this.pipeline([
      ["RPUSH", logKey, JSON.stringify(msg)],
      ["EXPIRE", logKey, LOG_TTL_SECONDS],
    ]).catch(() => undefined);
  }

  async readSince(code: string, cursor: number | null): Promise<RoomLogSlice> {
    const logKey = this.logKey(code);
    if (cursor === null) {
      // Join at the live head: a fresh stream gets its history from /sync.
      const len = await this.redis<number | null>(["LLEN", logKey]).catch(() => 0);
      return { cursor: len ?? 0, messages: [] };
    }

    // One command on the hot path. Redis commands are metered, and a room
    // that is producing messages is polled at the fast cadence.
    const rawSlice = await this.redis<string[] | null>([
      "LRANGE",
      logKey,
      cursor,
      -1,
    ]).catch(() => null);

    const slice = Array.isArray(rawSlice) ? rawSlice : [];
    if (slice.length === 0) {
      // Empty is ambiguous: either nothing new, or the log's TTL fired and
      // our cursor now points past a truncated list, which would go silent
      // forever. Only pay for the length check in that ambiguous case.
      const len = await this.redis<number | null>(["LLEN", logKey]).catch(() => null);
      if (typeof len === "number" && len < cursor) return { cursor: len, messages: [] };
      return { cursor, messages: [] };
    }

    const messages: RoomMessage[] = [];
    for (const raw of slice) {
      try {
        messages.push(JSON.parse(raw) as RoomMessage);
      } catch {
        // a corrupt entry must not wedge the cursor
      }
    }
    return { cursor: cursor + slice.length, messages };
  }

  subscribe(code: string, fn: (msg: RoomMessage) => void): () => void {
    const key = code.toUpperCase();
    const subs = this.subscribers.get(key) ?? new Set();
    subs.add(fn);
    this.subscribers.set(key, subs);
    return () => {
      subs.delete(fn);
      if (subs.size === 0) this.subscribers.delete(key);
    };
  }
}
