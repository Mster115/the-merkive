import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SeatIndex } from "@merky/game-sdk";
import { UpstashStore } from "../store/upstash";
import type { MatchRecord, PlayerSeatRecord, RoomRecord, SpectatorRecord } from "../store/types";

/**
 * UpstashStore is a thin HTTP wrapper around Upstash's REST Redis API —
 * every method sends `fetch(baseUrl, { body: JSON.stringify(command) })`
 * and expects back `{ result }`. This fakes that REST surface with a real
 * in-memory Redis-alike (Map/Set/Hash/List semantics), so every method on
 * the class actually executes against realistic backend behavior instead
 * of a shallow "was fetch called" mock. HGETALL in particular returns a
 * flat `[field, value, field, value, ...]` array — matching Upstash's real
 * REST response shape — because that's the branch the class's own
 * `Array.isArray(raw)` handling exists for; a fake that returned an object
 * instead would never exercise the code path production actually hits.
 */

type Scalar = string;
type RedisEntry = Scalar | Set<string> | Map<string, string> | string[];

let db: Map<string, RedisEntry>;
let failNextPublish: boolean;

function str(v: unknown): string {
  return String(v);
}

function fakeRedis(cmd: (string | number)[]): unknown {
  const [op, ...args] = cmd;
  switch (op) {
    case "SET": {
      const [k, v] = args;
      db.set(str(k), str(v));
      return "OK";
    }
    case "GET": {
      const [k] = args;
      const v = db.get(str(k));
      return typeof v === "string" ? v : null;
    }
    case "DEL": {
      const [k] = args;
      const existed = db.has(str(k));
      db.delete(str(k));
      return existed ? 1 : 0;
    }
    case "SADD": {
      const [k, member] = args;
      let s = db.get(str(k)) as Set<string> | undefined;
      if (!s) {
        s = new Set();
        db.set(str(k), s);
      }
      const had = s.has(str(member));
      s.add(str(member));
      return had ? 0 : 1;
    }
    case "SREM": {
      const [k, member] = args;
      const s = db.get(str(k)) as Set<string> | undefined;
      if (!s) return 0;
      return s.delete(str(member)) ? 1 : 0;
    }
    case "SMEMBERS": {
      const [k] = args;
      const s = db.get(str(k)) as Set<string> | undefined;
      return s ? Array.from(s) : [];
    }
    case "HSET": {
      const [k, field, value] = args;
      let h = db.get(str(k)) as Map<string, string> | undefined;
      if (!h) {
        h = new Map();
        db.set(str(k), h);
      }
      h.set(str(field), str(value));
      return 1;
    }
    case "HGET": {
      const [k, field] = args;
      const h = db.get(str(k)) as Map<string, string> | undefined;
      return h?.get(str(field)) ?? null;
    }
    case "HGETALL": {
      const [k] = args;
      const h = db.get(str(k)) as Map<string, string> | undefined;
      if (!h || h.size === 0) return null;
      const flat: string[] = [];
      for (const [f, v] of h) flat.push(f, v);
      return flat; // Real Upstash REST shape — not an object.
    }
    case "HDEL": {
      const [k, field] = args;
      const h = db.get(str(k)) as Map<string, string> | undefined;
      if (!h) return 0;
      return h.delete(str(field)) ? 1 : 0;
    }
    case "LRANGE": {
      const [k] = args;
      const l = db.get(str(k)) as string[] | undefined;
      return l ?? [];
    }
    case "RPUSH": {
      const [k, value] = args;
      let l = db.get(str(k)) as string[] | undefined;
      if (!l) {
        l = [];
        db.set(str(k), l);
      }
      l.push(str(value));
      return l.length;
    }
    case "PUBLISH": {
      if (failNextPublish) {
        failNextPublish = false;
        throw new Error("simulated redis publish failure");
      }
      return 0;
    }
    default:
      throw new Error(`fakeRedis: unhandled command ${String(op)}`);
  }
}

let originalFetch: typeof fetch;

beforeEach(() => {
  db = new Map();
  failNextPublish = false;
  originalFetch = global.fetch;
  global.fetch = (async (_url: string, init?: RequestInit) => {
    const cmd = JSON.parse(String(init?.body)) as (string | number)[];
    try {
      const result = fakeRedis(cmd);
      return new Response(JSON.stringify({ result }), { status: 200 });
    } catch {
      return new Response("simulated failure", { status: 500, statusText: "Internal Server Error" });
    }
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function makeRoom(overrides: Partial<RoomRecord> = {}): RoomRecord {
  const now = Date.now();
  return {
    id: "room-1",
    code: "ABCD",
    status: "lobby",
    hostSeat: 0,
    gameId: null,
    settings: {},
    maxPlayers: 12,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 60_000,
    pausedAt: null,
    lastMatch: null,
    ...overrides,
  };
}

function makeSeat(seatIndex: SeatIndex, overrides: Partial<PlayerSeatRecord> = {}): PlayerSeatRecord {
  const now = Date.now();
  return {
    roomId: "room-1",
    seatIndex,
    playerUid: `uid-${seatIndex}`,
    displayName: `P${seatIndex}`,
    avatarId: "fox",
    connected: true,
    joinedAt: now,
    lastSeenAt: now,
    disconnectedAt: null,
    abandoned: false,
    ...overrides,
  };
}

describe("UpstashStore", () => {
  it("round-trips a room by id and by code", async () => {
    const store = new UpstashStore("https://fake", "token");
    const room = makeRoom();
    await store.createRoom(room);

    expect(await store.getRoomById(room.id)).toEqual(room);
    expect(await store.getRoomByCode(room.code)).toEqual(room);
    expect(await store.getRoomByCode(room.code.toLowerCase())).toEqual(room); // case-insensitive lookup
    expect(await store.getRoomById("missing")).toBeNull();
    expect(await store.getRoomByCode("ZZZZ")).toBeNull();
  });

  it("updateRoom patches fields and bumps updatedAt; setting status expired drops it from the active set", async () => {
    const store = new UpstashStore("https://fake", "token");
    const room = makeRoom();
    await store.createRoom(room);

    await store.updateRoom(room.id, { status: "in_game", gameId: "merkade" });
    const updated = await store.getRoomById(room.id);
    expect(updated?.status).toBe("in_game");
    expect(updated?.gameId).toBe("merkade");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(room.updatedAt);

    expect(await store.listActiveRooms()).toHaveLength(1);
    await store.updateRoom(room.id, { status: "expired" });
    expect(await store.listActiveRooms()).toHaveLength(0);

    // Patching a room that doesn't exist is a silent no-op, not an error.
    await expect(store.updateRoom("missing", { status: "expired" })).resolves.toBeUndefined();
  });

  it("listActiveRooms excludes expired rooms but includes everything else", async () => {
    const store = new UpstashStore("https://fake", "token");
    await store.createRoom(makeRoom({ id: "r1", code: "AAAA" }));
    await store.createRoom(makeRoom({ id: "r2", code: "BBBB", status: "expired" }));
    await store.createRoom(makeRoom({ id: "r3", code: "CCCC", status: "in_game" }));

    const active = await store.listActiveRooms();
    expect(active.map((r) => r.id).sort()).toEqual(["r1", "r3"]);
  });

  it("deleteRoom removes the room, its code index, active-set membership, seats, and spectators", async () => {
    const store = new UpstashStore("https://fake", "token");
    const room = makeRoom();
    await store.createRoom(room);
    await store.upsertSeat(makeSeat(0));
    await store.upsertSpectator({ roomId: room.id, uid: "spec-1", displayName: "S", avatarId: "cat", connected: true, lastSeenAt: Date.now() });

    await store.deleteRoom(room.id);

    expect(await store.getRoomById(room.id)).toBeNull();
    expect(await store.getRoomByCode(room.code)).toBeNull();
    expect(await store.listActiveRooms()).toHaveLength(0);
    expect(await store.listSeats(room.id)).toEqual([]);
    expect(await store.listSpectators(room.id)).toEqual([]);
  });

  it("listSeats returns every seat sorted by seatIndex, including seat 11 (the top of the 12-seat range)", async () => {
    const store = new UpstashStore("https://fake", "token");
    const order = [3, 0, 11, 7, 1];
    for (const i of order) {
      await store.upsertSeat(makeSeat(i as SeatIndex));
    }
    const seats = await store.listSeats("room-1");
    expect(seats.map((s) => s.seatIndex)).toEqual([0, 1, 3, 7, 11]);
    expect(seats.find((s) => s.seatIndex === 11)?.displayName).toBe("P11");
  });

  it("updateSeat patches an existing seat and is a no-op for a missing one; removeSeat deletes it", async () => {
    const store = new UpstashStore("https://fake", "token");
    await store.upsertSeat(makeSeat(0, { displayName: "Original" }));

    await store.updateSeat("room-1", 0 as SeatIndex, { displayName: "Renamed", connected: false });
    let seats = await store.listSeats("room-1");
    expect(seats[0]).toMatchObject({ displayName: "Renamed", connected: false });

    await expect(store.updateSeat("room-1", 5 as SeatIndex, { displayName: "Ghost" })).resolves.toBeUndefined();
    seats = await store.listSeats("room-1");
    expect(seats).toHaveLength(1); // patching a missing seat never creates one

    await store.removeSeat("room-1", 0 as SeatIndex);
    expect(await store.listSeats("room-1")).toEqual([]);
  });

  it("round-trips spectators: upsert, list, remove", async () => {
    const store = new UpstashStore("https://fake", "token");
    const spec: SpectatorRecord = { roomId: "room-1", uid: "u1", displayName: "Watcher", avatarId: "owl", connected: true, lastSeenAt: Date.now() };
    await store.upsertSpectator(spec);
    expect(await store.listSpectators("room-1")).toEqual([spec]);

    await store.upsertSpectator({ ...spec, connected: false });
    expect(await store.listSpectators("room-1")).toEqual([{ ...spec, connected: false }]);

    await store.removeSpectator("room-1", "u1");
    expect(await store.listSpectators("room-1")).toEqual([]);
  });

  it("round-trips a match by id and as the room's active match", async () => {
    const store = new UpstashStore("https://fake", "token");
    const match: MatchRecord = {
      id: "match-1",
      roomId: "room-1",
      gameId: "merkade",
      status: "active",
      phase: "round_intro",
      seed: "seed-1",
      version: 0,
      settings: {},
      publicState: { roundIndex: 0 },
      privateState: {},
      scores: {},
      timer: null,
      over: false,
      startedAt: Date.now(),
      endedAt: null,
    };
    await store.createMatch(match);
    expect(await store.getMatch("match-1")).toEqual(match);
    expect(await store.getActiveMatch("room-1")).toEqual(match);
    expect(await store.getActiveMatch("no-such-room")).toBeNull();
  });

  it("applyMatchUpdate merges patches with omit-keeps/present-replaces semantics and rejects on version mismatch", async () => {
    const store = new UpstashStore("https://fake", "token");
    const match: MatchRecord = {
      id: "match-1",
      roomId: "room-1",
      gameId: "merkade",
      status: "active",
      phase: "round_intro",
      seed: "seed-1",
      version: 0,
      settings: {},
      publicState: { roundIndex: 0 },
      privateState: { 0: { secret: "a" }, 1: { secret: "b" } },
      secretState: { marker: "SECRET" },
      scores: { 0: 10 },
      timer: { endsAt: 1000, kind: "round_intro", durationMs: 1000 },
      over: false,
      startedAt: Date.now(),
      endedAt: null,
    };
    await store.createMatch(match);

    // Version mismatch: rejected, nothing written.
    const conflict = await store.applyMatchUpdate("match-1", 5, {
      version: 6,
      phase: "round_intro",
      publicState: { roundIndex: 99 },
      events: [],
      actorSeat: "system",
    });
    expect(conflict).toBe("conflict");
    expect((await store.getMatch("match-1"))?.publicState).toEqual({ roundIndex: 0 });

    // Correct version: privateStatePatch merges (seat 1 untouched), scoresPatch
    // merges, secretState omitted keeps the old value, timer omitted keeps it.
    const ok = await store.applyMatchUpdate("match-1", 0, {
      version: 1,
      phase: "fib_answer",
      publicState: { roundIndex: 0, fibFact: "x" },
      privateStatePatch: { 0: { secret: "a2" } },
      scoresPatch: { 0: 20 },
      events: [],
      actorSeat: 0,
    });
    expect(ok).toBe("ok");
    const afterOk = await store.getMatch("match-1");
    expect(afterOk?.version).toBe(1);
    expect(afterOk?.phase).toBe("fib_answer");
    expect(afterOk?.privateState).toEqual({ 0: { secret: "a2" }, 1: { secret: "b" } });
    expect(afterOk?.scores).toEqual({ 0: 20 });
    expect(afterOk?.secretState).toEqual({ marker: "SECRET" });
    expect(afterOk?.timer).toEqual({ endsAt: 1000, kind: "round_intro", durationMs: 1000 });

    // Explicit secretState: null replaces (clears) it; explicit timer replaces it.
    const cleared = await store.applyMatchUpdate("match-1", 1, {
      version: 2,
      phase: "fib_vote",
      publicState: { roundIndex: 0 },
      secretState: null,
      timer: null,
      events: [],
      actorSeat: "system",
    });
    expect(cleared).toBe("ok");
    const afterClear = await store.getMatch("match-1");
    expect(afterClear?.secretState).toBeNull();
    expect(afterClear?.timer).toBeNull();
  });

  it("round-trips custom packs and appends in insertion order", async () => {
    const store = new UpstashStore("https://fake", "token");
    await store.createCustomPack({ id: "p1", gameId: "merkade", title: "Pack One", locale: "en", payload: {}, createdAt: 1 });
    await store.createCustomPack({ id: "p2", gameId: "merkade", title: "Pack Two", locale: "en", payload: {}, createdAt: 2 });
    await store.createCustomPack({ id: "p3", gameId: "other-game", title: "Other", locale: "en", payload: {}, createdAt: 3 });

    const packs = await store.listCustomPacks("merkade");
    expect(packs.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("fans a published message out to local subscribers, honors unsubscribe, and never throws even if the redis PUBLISH call fails", async () => {
    const store = new UpstashStore("https://fake", "token");
    const received: unknown[] = [];
    const unsubscribe = store.subscribe("abcd", (msg) => received.push(msg));

    await store.publish("ABCD", { kind: "room" } as never); // code is uppercased for the subscriber key
    expect(received).toHaveLength(1);

    unsubscribe();
    await store.publish("abcd", { kind: "room" } as never);
    expect(received).toHaveLength(1); // no further delivery after unsubscribe

    failNextPublish = true;
    await expect(store.publish("abcd", { kind: "match" } as never)).resolves.toBeUndefined();
  });
});
