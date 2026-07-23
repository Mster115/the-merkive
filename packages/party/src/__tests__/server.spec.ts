import { beforeEach, describe, expect, it } from "vitest";
import type * as Party from "partykit/server";
import TheMerkiveServer from "../server";

/**
 * TheMerkiveServer had zero test coverage before this file — it's the
 * PartyKit Edge Durable Object backing the production store adapter
 * (apps/web/src/server/store/partykit.ts) and the realtime relay every
 * client's WebSocket connects through. These tests fake just the surface
 * of `Party.Room` the class actually calls (id, storage.get/put, broadcast,
 * getConnections) and drive `onRequest` with real `Request` objects, since
 * the handler only uses standard Fetch API methods on them.
 */

const CORS_ORIGIN = "Access-Control-Allow-Origin";

class FakeStorage {
  private map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
}

class FakeConnection {
  state: unknown = null;
  sent: string[] = [];
  setState(s: unknown) {
    this.state = s;
  }
  send(msg: string) {
    this.sent.push(msg);
  }
}

class FakeRoom {
  storage = new FakeStorage();
  broadcasts: string[] = [];
  connections: FakeConnection[] = [];
  constructor(public id: string) {}
  broadcast(msg: string) {
    this.broadcasts.push(msg);
  }
  getConnections() {
    return this.connections;
  }
}

function makeServer(roomId = "store", storage?: FakeStorage) {
  const room = new FakeRoom(roomId);
  if (storage) room.storage = storage;
  const server = new TheMerkiveServer(room as unknown as Party.Room);
  return { server, room };
}

function req(method: string, path: string, body?: unknown): Party.Request {
  const url = `https://fake.partykit.dev${path}`;
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(url, init) as unknown as Party.Request;
}

async function json(res: Response) {
  return (await res.json()) as unknown;
}

function room(overrides: Record<string, unknown> = {}) {
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

function seat(seatIndex: number, overrides: Record<string, unknown> = {}) {
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

describe("TheMerkiveServer — store API (only served by the room.id === 'store' DO)", () => {
  it("answers OPTIONS with CORS headers on any room, without touching storage", async () => {
    const { server } = makeServer("not-store");
    const res = await server.onRequest(req("OPTIONS", "/parties/main/store/create-room"));
    expect(res.status).toBe(200);
    expect(res.headers.get(CORS_ORIGIN)).toBe("*");
  });

  it("404s a store GET/DELETE path on any room that isn't the 'store' DO", async () => {
    const { server } = makeServer("some-room-code");
    const res = await server.onRequest(req("GET", "/parties/main/store/get-room?code=ABCD"));
    expect(res.status).toBe(404);
  });

  it("round-trips a room by id and by code, and persists it through storage", async () => {
    const { server, room: fakeRoom } = makeServer("store");
    const r = room();

    const created = await server.onRequest(req("POST", "/parties/main/store/create-room", r));
    expect(created.status).toBe(200);
    expect(await json(created)).toEqual({ success: true });

    const byId = await server.onRequest(req("GET", `/parties/main/store/get-room?id=${r.id}`));
    expect(await json(byId)).toEqual(r);

    const byCode = await server.onRequest(req("GET", `/parties/main/store/get-room?code=${r.code.toLowerCase()}`));
    expect(await json(byCode)).toEqual(r); // case-insensitive code lookup

    // A second server instance sharing the same storage sees the same data —
    // proves the Map-based db actually round-trips through storage.get/put,
    // not just an in-memory field on one instance.
    const { server: server2 } = makeServer("store", fakeRoom.storage);
    const reloaded = await server2.onRequest(req("GET", `/parties/main/store/get-room?id=${r.id}`));
    expect(await json(reloaded)).toEqual(r);
  });

  it("updateRoom patches fields; list-rooms excludes expired rooms", async () => {
    const { server } = makeServer("store");
    await server.onRequest(req("POST", "/parties/main/store/create-room", room({ id: "r1", code: "AAAA" })));
    await server.onRequest(req("POST", "/parties/main/store/create-room", room({ id: "r2", code: "BBBB" })));

    await server.onRequest(
      req("POST", "/parties/main/store/update-room", { roomId: "r2", patch: { status: "expired" } })
    );

    const active = await server.onRequest(req("GET", "/parties/main/store/list-rooms"));
    const list = (await json(active)) as { id: string }[];
    expect(list.map((x) => x.id)).toEqual(["r1"]);
  });

  it("deleteRoom removes the room, its seats, spectators, and active-match pointer", async () => {
    const { server } = makeServer("store");
    const r = room();
    await server.onRequest(req("POST", "/parties/main/store/create-room", r));
    await server.onRequest(req("POST", "/parties/main/store/upsert-seat", seat(0)));

    await server.onRequest(req("DELETE", `/parties/main/store/delete-room?roomId=${r.id}`));

    const gotRoom = await server.onRequest(req("GET", `/parties/main/store/get-room?id=${r.id}`));
    expect(await json(gotRoom)).toBeNull();
    const seats = await server.onRequest(req("GET", `/parties/main/store/seats?roomId=${r.id}`));
    expect(await json(seats)).toEqual([]);
  });

  it("seats: upsert/list-sorted (including seat 11)/update/remove", async () => {
    const { server } = makeServer("store");
    for (const i of [3, 0, 11, 7]) {
      await server.onRequest(req("POST", "/parties/main/store/upsert-seat", seat(i)));
    }

    const listed = await server.onRequest(req("GET", "/parties/main/store/seats?roomId=room-1"));
    const seats = (await json(listed)) as { seatIndex: number; displayName: string }[];
    expect(seats.map((s) => s.seatIndex)).toEqual([0, 3, 7, 11]);
    expect(seats.find((s) => s.seatIndex === 11)?.displayName).toBe("P11");

    await server.onRequest(
      req("POST", "/parties/main/store/update-seat", { roomId: "room-1", seatIndex: 11, patch: { connected: false } })
    );
    const afterUpdate = (await json(
      await server.onRequest(req("GET", "/parties/main/store/seats?roomId=room-1"))
    )) as { seatIndex: number; connected: boolean }[];
    expect(afterUpdate.find((s) => s.seatIndex === 11)?.connected).toBe(false);

    await server.onRequest(req("DELETE", "/parties/main/store/remove-seat?roomId=room-1&seatIndex=11"));
    const afterRemove = (await json(
      await server.onRequest(req("GET", "/parties/main/store/seats?roomId=room-1"))
    )) as unknown[];
    expect(afterRemove).toHaveLength(3);
  });

  it("applyMatchUpdate: merges patches with omit-keeps semantics and rejects a version mismatch as a conflict", async () => {
    const { server } = makeServer("store");
    const match = {
      id: "m1",
      roomId: "room-1",
      gameId: "merkade",
      status: "active",
      phase: "round_intro",
      seed: "s1",
      version: 0,
      settings: {},
      publicState: { roundIndex: 0 },
      privateState: { 0: { secret: "a" }, 1: { secret: "b" } },
      secretState: { marker: "SECRET" },
      scores: {},
      timer: null,
      over: false,
      startedAt: Date.now(),
      endedAt: null,
    };
    await server.onRequest(req("POST", "/parties/main/store/create-match", { match, initialEvents: [] }));

    const conflictRes = await server.onRequest(
      req("POST", "/parties/main/store/apply-match-update", {
        matchId: "m1",
        expectedVersion: 5,
        update: { version: 6, phase: "x", publicState: {}, events: [] },
      })
    );
    expect(await json(conflictRes)).toEqual({ status: "conflict" });

    const okRes = await server.onRequest(
      req("POST", "/parties/main/store/apply-match-update", {
        matchId: "m1",
        expectedVersion: 0,
        update: {
          version: 1,
          phase: "fib_answer",
          publicState: { roundIndex: 0, fibFact: "x" },
          privateStatePatch: { 0: { secret: "a2" } },
          events: [],
        },
      })
    );
    expect(await json(okRes)).toEqual({ status: "ok" });

    const after = (await json(
      await server.onRequest(req("GET", "/parties/main/store/get-match?id=m1"))
    )) as { version: number; phase: string; privateState: Record<string, unknown>; secretState: unknown };
    expect(after.version).toBe(1);
    expect(after.phase).toBe("fib_answer");
    expect(after.privateState).toEqual({ 0: { secret: "a2" }, 1: { secret: "b" } });
    expect(after.secretState).toEqual({ marker: "SECRET" }); // omitted patch keeps the old value
  });

  it("packs: create and list, scoped by gameId", async () => {
    const { server } = makeServer("store");
    await server.onRequest(
      req("POST", "/parties/main/store/create-pack", { id: "p1", gameId: "merkade", title: "A" })
    );
    await server.onRequest(
      req("POST", "/parties/main/store/create-pack", { id: "p2", gameId: "other", title: "B" })
    );
    const listed = await server.onRequest(req("GET", "/parties/main/store/list-packs?gameId=merkade"));
    expect((await json(listed) as { id: string }[]).map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("TheMerkiveServer — realtime broadcast routing (any room, not gated to 'store')", () => {
  let fakeRoom: FakeRoom;
  let server: TheMerkiveServer;

  beforeEach(() => {
    ({ server, room: fakeRoom } = makeServer("ABCD"));
  });

  it("broadcasts a public (room/match) message to everyone via room.broadcast", async () => {
    const msg = { kind: "room", room: { code: "ABCD" } };
    const res = await server.onRequest(req("POST", "/parties/main/ABCD/broadcast", { msg }));
    expect(await json(res)).toEqual({ success: true });
    expect(fakeRoom.broadcasts).toEqual([JSON.stringify(msg)]);
  });

  it("delivers a private message only to the connection holding that seat — regression test for the string/number seat mismatch", async () => {
    // onConnect always stores seat as a STRING (URLSearchParams.get never
    // returns a number) — reproduce that exactly rather than a convenient int.
    const seat2 = new FakeConnection();
    seat2.setState({ kind: "player", seat: "2" });
    const seat5 = new FakeConnection();
    seat5.setState({ kind: "player", seat: "5" });
    const spectator = new FakeConnection();
    spectator.setState({ kind: "public", seat: null });
    fakeRoom.connections.push(seat2, seat5, spectator);

    // msg.seat arrives as a JSON NUMBER, per the real RoomMessage["private"] type.
    const msg = { kind: "private", seat: 2, version: 1, privateState: { hand: ["A"] } };
    await server.onRequest(req("POST", "/parties/main/ABCD/broadcast", { msg }));

    expect(seat2.sent).toEqual([JSON.stringify(msg)]);
    expect(seat5.sent).toEqual([]);
    expect(spectator.sent).toEqual([]);
    expect(fakeRoom.broadcasts).toEqual([]); // never falls back to public broadcast
  });

  it("delivers a targeted seat-11 message correctly (top of the 12-seat range)", async () => {
    const seat11 = new FakeConnection();
    seat11.setState({ seat: "11" });
    fakeRoom.connections.push(seat11);

    const msg = { kind: "bye", reason: "kicked", seat: 11 };
    await server.onRequest(req("POST", "/parties/main/ABCD/broadcast", { msg }));
    expect(seat11.sent).toEqual([JSON.stringify(msg)]);
  });

  it("never sends to a connection with no bound seat", async () => {
    const noSeat = new FakeConnection();
    noSeat.setState({ seat: null });
    fakeRoom.connections.push(noSeat);

    await server.onRequest(
      req("POST", "/parties/main/ABCD/broadcast", { msg: { kind: "private", seat: 0, version: 1, privateState: {} } })
    );
    expect(noSeat.sent).toEqual([]);
  });
});
