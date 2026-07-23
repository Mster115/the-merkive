import { beforeEach, describe, expect, it } from "vitest";
import { defineGame, type SeatIndex } from "@merky/game-sdk";
import { gameRegistry } from "@merky/games";
import type { RoomMessage } from "@/shared/messages";
import { MemoryStore } from "../store/memory";
import { applyAction, createRoom, joinRoom, snapshotFor, startMatch, updateRoomSettings } from "../service";

/**
 * Proves the 8 → 12 seat capacity change end-to-end through the real
 * service → runtime → store pipeline: the room's seat ceiling and each
 * game's own maxPlayers stay independent, a full 12-seat match resolves
 * correctly, and no seat's private/secret state leaks to another seat or a
 * spectator — the specific new risk surface above the old 8-seat ceiling
 * (seats 8-11 didn't exist for any test to exercise before this change).
 */

const MARKER = "CAPACITY_SECRET_MARKER_QWERTY";

const capacityGame = defineGame({
  meta: {
    id: "capacitytest",
    nameKey: "games.capacitytest.name",
    descriptionKey: "games.capacitytest.description",
    minPlayers: 2,
    maxPlayers: 12,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["test"],
    defaultSettings: {},
    settingFields: [],
  },
  i18n: {
    en: {
      "games.capacitytest.name": "Capacity Exerciser",
      "games.capacitytest.description": "Platform 12-seat pipeline test",
    },
  },
  init(ctx) {
    return {
      publicState: { seatCount: ctx.seats.length },
      privateState: Object.fromEntries(ctx.seats.map((s) => [s.seatIndex, { secret: `seat-${s.seatIndex}-secret` }])),
      secretState: { marker: MARKER },
      phase: "playing",
      events: [],
    };
  },
  reduce(ctx, state, action) {
    const pub = state.publicState as { seatCount: number };
    if (action.type === "finish") {
      const scores = Object.fromEntries(ctx.seats.map((s) => [String(s.seatIndex), s.seatIndex + 1]));
      return {
        publicState: pub,
        phase: "game_over",
        matchOver: true,
        scores,
        events: [],
      };
    }
    return { error: "unknown action", code: "bad_action" };
  },
  awaitedSeats() {
    return [];
  },
  ui: { Stage: () => null, Controller: () => null },
});

// A second game with a smaller maxPlayers than the room's own ceiling,
// to prove the two caps are enforced independently.
const smallCapGame = defineGame({
  meta: {
    id: "smallcaptest",
    nameKey: "games.smallcaptest.name",
    descriptionKey: "games.smallcaptest.description",
    minPlayers: 2,
    maxPlayers: 6,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["test"],
    defaultSettings: {},
    settingFields: [],
  },
  i18n: {
    en: {
      "games.smallcaptest.name": "Small Cap Exerciser",
      "games.smallcaptest.description": "Proves a game's own maxPlayers is enforced independent of the room cap",
    },
  },
  init(ctx) {
    return {
      publicState: {},
      privateState: Object.fromEntries(ctx.seats.map((s) => [s.seatIndex, {}])),
      phase: "playing",
      events: [],
    };
  },
  reduce() {
    return { error: "unknown action", code: "bad_action" };
  },
  awaitedSeats() {
    return [];
  },
  ui: { Stage: () => null, Controller: () => null },
});

function freshStore(): MemoryStore {
  const store = new MemoryStore();
  globalThis.__mbStore = store;
  globalThis.__mbSweeper ??= setInterval(() => undefined, 1 << 30);
  return store;
}

const HOST = "uid-host";

/** Joins `n - 1` additional players (host already occupies seat 0). Returns their uids in seat order. */
async function joinN(code: string, n: number): Promise<string[]> {
  const uids: string[] = [];
  for (let i = 1; i < n; i++) {
    const uid = `uid-p${i}`;
    await joinRoom(code, { uid, fresh: false, name: `P${i}`, avatarId: "cat", role: "player" });
    uids.push(uid);
  }
  return uids;
}

describe("12-seat capacity contract", () => {
  beforeEach(() => {
    gameRegistry["capacitytest"] = capacityGame;
    gameRegistry["smallcaptest"] = smallCapGame;
  });

  it("fills all 12 room seats and rejects a 13th join with room_full", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    for (let i = 1; i < 12; i++) {
      const r = await joinRoom(code, { uid: `uid-${i}`, fresh: false, name: `P${i}`, avatarId: "cat", role: "player" });
      expect(r.snapshot.you.seatIndex).toBe(i);
    }
    await expect(
      joinRoom(code, { uid: "uid-13", fresh: false, name: "Nope", avatarId: "cat", role: "player" })
    ).rejects.toMatchObject({ code: "room_full" });
  });

  it("keeps the room seat ceiling and a game's own maxPlayers independent", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    // The room itself allows up to 12 seats regardless of which game is picked.
    await joinN(code, 8); // 8 total seats now (host + 7)
    await updateRoomSettings(code, HOST, { gameId: "smallcaptest", settings: {} });
    // smallcaptest caps at 6 players — starting with 8 seated must be
    // rejected on the GAME's own limit, even though the room would allow
    // up to 12.
    await expect(startMatch(code, HOST)).rejects.toMatchObject({ code: "need_players" });
  });

  it("runs a full 12-seat match lifecycle to game_over with correct per-seat scores", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    await joinN(code, 12);
    await updateRoomSettings(code, HOST, { gameId: "capacitytest", settings: {} });
    await startMatch(code, HOST);

    let snap = await snapshotFor(code, HOST);
    expect(snap.room.seats).toHaveLength(12);
    expect(snap.match?.phase).toBe("playing");

    expect(await applyAction(code, HOST, { type: "finish" })).toEqual({ ok: true });

    snap = await snapshotFor(code, HOST);
    expect(snap.room.status).toBe("lobby");
    expect(snap.room.lastMatch?.seats).toHaveLength(12);
    for (let s = 0; s < 12; s++) {
      expect(snap.room.lastMatch?.scores[s as SeatIndex]).toBe(s + 1);
    }
  });

  it("never leaks another seat's privateState or secretState at 12 seats, including seats 8-11", async () => {
    freshStore();
    const store = globalThis.__mbStore as MemoryStore;
    const { code } = await createRoom(HOST, "Ana", "fox");
    const uids = await joinN(code, 12);
    const allUids = [HOST, ...uids];
    expect(allUids).toHaveLength(12);

    const published: RoomMessage[] = [];
    store.subscribe(code, (m) => published.push(m));

    await updateRoomSettings(code, HOST, { gameId: "capacitytest", settings: {} });
    await startMatch(code, HOST);

    // Every own-seat snapshot must see exactly its own secret and no one else's.
    for (let seat = 0; seat < 12; seat++) {
      const snap = await snapshotFor(code, allUids[seat]!);
      expect(snap.you.seatIndex).toBe(seat);
      expect(snap.you.privateState).toEqual({ secret: `seat-${seat}-secret` });
      const raw = JSON.stringify(snap);
      expect(raw).not.toContain(MARKER);
      expect(raw).not.toContain("secretState");
      for (let other = 0; other < 12; other++) {
        if (other === seat) continue;
        expect(raw).not.toContain(`seat-${other}-secret`);
      }
    }

    // Spectator view: no private/secret state for anyone.
    const specSnap = await snapshotFor(code, null);
    const specRaw = JSON.stringify(specSnap);
    expect(specRaw).not.toContain(MARKER);
    expect(specRaw).not.toContain("secretState");
    for (let s = 0; s < 12; s++) {
      expect(specRaw).not.toContain(`seat-${s}-secret`);
    }

    // Every published message — including private ones for seats 8-11, the
    // territory that didn't exist under the old 8-seat cap — must stay
    // scoped to its own seat.
    expect(published.length).toBeGreaterThan(0);
    for (const msg of published) {
      const raw = JSON.stringify(msg);
      expect(raw).not.toContain(MARKER);
      expect(raw).not.toContain("secretState");
      if (msg.kind === "private") {
        for (let other = 0; other < 12; other++) {
          if (other === msg.seat) continue;
          expect(raw).not.toContain(`seat-${other}-secret`);
        }
      }
    }
    const privateSeats = new Set(
      published.filter((m) => m.kind === "private").map((m) => (m.kind === "private" ? m.seat : -1))
    );
    expect(privateSeats).toEqual(new Set(Array.from({ length: 12 }, (_, i) => i)));
  });

  it("round-trips seat index 11 correctly through the store boundary", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    const uids = await joinN(code, 12);
    await updateRoomSettings(code, HOST, { gameId: "capacitytest", settings: {} });
    await startMatch(code, HOST);

    const lastUid = uids[uids.length - 1]!;
    const snap = await snapshotFor(code, lastUid);
    expect(snap.you.seatIndex).toBe(11);
    expect(snap.you.privateState).toEqual({ secret: "seat-11-secret" });
  });
});
