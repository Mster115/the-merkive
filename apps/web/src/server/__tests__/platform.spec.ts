import { beforeEach, describe, expect, it } from "vitest";
import { defineGame, type SeatIndex } from "@merky/game-sdk";
import { gameRegistry } from "@merky/games";
import type { RoomMessage } from "@/shared/messages";
import { MemoryStore } from "../store/memory";
import {
  applyAction,
  createPack,
  createRoom,
  joinRoom,
  kickSeat,
  leaveRoom,
  presenceOpen,
  snapshotFor,
  startMatch,
  sweepAll,
  transferHost,
  updateRoomSettings,
} from "../service";

/**
 * A minimal deterministic game to exercise the platform pipeline:
 * - "add" action: +n points to the acting seat, next seat's turn
 * - first seat to reach `target` ends the match
 * - a "turn" timer; onTick auto-passes the turn
 * - bots pass their turn
 */
const testGame = defineGame({
  meta: {
    id: "testgame",
    nameKey: "games.testgame.name",
    descriptionKey: "games.testgame.description",
    minPlayers: 2,
    maxPlayers: 8,
    supportsSpectators: true,
    supportsMidGameJoin: true,
    tags: ["test"],
    defaultSettings: { target: 3, turnSeconds: 30 },
    settingFields: [
      { key: "target", labelKey: "games.testgame.target", type: "number", default: 3, min: 1, max: 10 },
    ],
  },
  i18n: {
    en: {
      "games.testgame.name": "Test Game",
      "games.testgame.description": "Platform pipeline exerciser",
      "games.testgame.target": "Target",
    },
  },
  init(ctx) {
    return {
      publicState: { active: 0, totals: Object.fromEntries(ctx.seats.map((s) => [s.seatIndex, 0])) },
      privateState: Object.fromEntries(ctx.seats.map((s) => [s.seatIndex, { secret: `s${s.seatIndex}` }])),
      phase: "playing",
      events: [{ type: "started" }],
      timer: { endsAt: ctx.now + 30_000, kind: "turn", durationMs: 30_000 },
    };
  },
  reduce(ctx, state, action) {
    const pub = state.publicState as { active: number; totals: Record<string, number> };
    if (action.type === "add") {
      if (action.seat !== pub.active) return { error: "not your turn", code: "not_your_turn" };
      const n = typeof (action.payload as { n?: number })?.n === "number" ? (action.payload as { n: number }).n : 1;
      const totals: Record<string, number> = {
        ...pub.totals,
        [String(action.seat)]: (pub.totals[String(action.seat)] ?? 0) + n,
      };
      const seatIdxs = ctx.seats.map((s) => s.seatIndex);
      const next = seatIdxs[(seatIdxs.indexOf(action.seat as SeatIndex) + 1) % seatIdxs.length]!;
      const target = ctx.settings.target as number;
      const won = (totals[String(action.seat)] ?? 0) >= target;
      return {
        publicState: { active: won ? -1 : next, totals },
        phase: won ? "game_over" : "playing",
        scores: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v * 100])),
        events: [{ type: "added", payload: { seat: action.seat, n } }],
        timer: won ? null : { endsAt: ctx.now + 30_000, kind: "turn", durationMs: 30_000 },
        matchOver: won,
      };
    }
    if (action.type === "pass") {
      const seatIdxs = ctx.seats.map((s) => s.seatIndex);
      const next = seatIdxs[(seatIdxs.indexOf(pub.active as SeatIndex) + 1) % seatIdxs.length]!;
      return {
        publicState: { ...pub, active: next },
        phase: "playing",
        events: [{ type: "passed" }],
        timer: { endsAt: ctx.now + 30_000, kind: "turn", durationMs: 30_000 },
      };
    }
    return { error: "unknown action", code: "bad_action" };
  },
  onTick(ctx, state) {
    const pub = state.publicState as { active: number };
    if (pub.active < 0) return null;
    const seatIdxs = ctx.seats.map((s) => s.seatIndex);
    const next = seatIdxs[(seatIdxs.indexOf(pub.active as SeatIndex) + 1) % seatIdxs.length]!;
    return {
      publicState: { ...(state.publicState as object), active: next },
      phase: "playing",
      events: [{ type: "timeout_pass" }],
      timer: { endsAt: ctx.now + 30_000, kind: "turn", durationMs: 30_000 },
    };
  },
  awaitedSeats(_ctx, state) {
    const pub = state.publicState as { active: number };
    return pub.active >= 0 ? [pub.active as SeatIndex] : [];
  },
  suggestBotAction() {
    return { type: "pass" };
  },
  ui: {
    Stage: () => null,
    Controller: () => null,
  },
});

function freshStore(): MemoryStore {
  const store = new MemoryStore();
  globalThis.__mbStore = store;
  // avoid interval leaks in tests: pretend sweeper exists
  globalThis.__mbSweeper ??= setInterval(() => undefined, 1 << 30);
  return store;
}

const HOST = "uid-host";
const P2 = "uid-p2";
const P3 = "uid-p3";

async function setupStartedRoom() {
  freshStore();
  const created = await createRoom(HOST, "Ana", "fox");
  const code = created.code;
  await joinRoom(code, { uid: P2, fresh: false, name: "Bo", avatarId: "cat", role: "player" });
  await joinRoom(code, { uid: P3, fresh: false, name: "Cy", avatarId: "owl", role: "player" });
  await updateRoomSettings(code, HOST, { gameId: "testgame", settings: { target: 2 } });
  await startMatch(code, HOST);
  return code;
}

describe("platform spine", () => {
  beforeEach(() => {
    gameRegistry["testgame"] = testGame;
  });

  it("creates a room with a valid code and seats the host", async () => {
    freshStore();
    const res = await createRoom(HOST, "Ana", "fox");
    expect(res.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(res.snapshot.you.seatIndex).toBe(0);
    expect(res.snapshot.room.seats).toHaveLength(1);
    expect(res.snapshot.room.seats[0]?.isHost).toBe(true);
  });

  it("assigns lowest free seats and rejects a 13th player", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    for (let i = 1; i < 12; i++) {
      const r = await joinRoom(code, {
        uid: `uid-${i}`,
        fresh: false,
        name: `P${i}`,
        avatarId: "cat",
        role: "player",
      });
      expect(r.snapshot.you.seatIndex).toBe(i);
    }
    await expect(
      joinRoom(code, { uid: "uid-13", fresh: false, name: "Nope", avatarId: "cat", role: "player" })
    ).rejects.toMatchObject({ code: "room_full" });
  });

  it("reclaims a seat for the same identity instead of double-seating", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    const again = await joinRoom(code, {
      uid: HOST,
      fresh: false,
      name: "Ana2",
      avatarId: "cat",
      role: "player",
    });
    expect(again.snapshot.you.seatIndex).toBe(0);
    expect(again.snapshot.room.seats).toHaveLength(1);
  });

  it("fresh:true always mints a distinct seat, even if the resolved uid collides with an existing player", async () => {
    // Regression: a browser can resolve the *same* uid for two different
    // "join" attempts (e.g. a stale per-room cookie fallback shared across
    // tabs/devices on one browser). A client that means "join as a new
    // player" must pass fresh:true so this never silently reclaims someone
    // else's seat instead of creating a new one.
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");
    const second = await joinRoom(code, {
      uid: HOST,
      fresh: true,
      name: "Bo",
      avatarId: "cat",
      role: "player",
    });
    expect(second.token).not.toBe(HOST);
    expect(second.snapshot.you.seatIndex).toBe(1);
    expect(second.snapshot.room.seats).toHaveLength(2);
    expect(second.snapshot.room.seats.map((s) => s.displayName).sort()).toEqual(["Ana", "Bo"]);
  });

  it("runs a full match: start → turns → scores → finalize → podium in lobby", async () => {
    const code = await setupStartedRoom();

    let snap = await snapshotFor(code, HOST);
    expect(snap.room.status).toBe("in_game");
    expect(snap.match?.phase).toBe("playing");
    expect(snap.you.privateState).toEqual({ secret: "s0" });

    // wrong-turn action is rejected by the game, not the platform
    const bad = await applyAction(code, P2, { type: "add" });
    expect(bad).toMatchObject({ ok: false, code: "not_your_turn" });

    expect(await applyAction(code, HOST, { type: "add" })).toEqual({ ok: true }); // host: 1
    expect(await applyAction(code, P2, { type: "add" })).toEqual({ ok: true });
    expect(await applyAction(code, P3, { type: "add" })).toEqual({ ok: true });
    expect(await applyAction(code, HOST, { type: "add" })).toEqual({ ok: true }); // host: 2 → wins

    snap = await snapshotFor(code, HOST);
    expect(snap.room.status).toBe("lobby");
    expect(snap.match).toBeNull();
    expect(snap.room.lastMatch?.scores[0]).toBe(200);
    expect(snap.room.lastMatch?.seats).toHaveLength(3);
  });

  it("enforces idempotency keys", async () => {
    const code = await setupStartedRoom();
    const key = "same-key";
    expect(await applyAction(code, HOST, { type: "add", idempotencyKey: key })).toEqual({ ok: true });
    expect(await applyAction(code, HOST, { type: "add", idempotencyKey: key })).toEqual({ ok: true });
    const snap = await snapshotFor(code, HOST);
    const pub = snap.match?.publicState as { totals: Record<string, number> };
    expect(pub.totals["0"]).toBe(1); // applied once
  });

  it("fires expired timers lazily via the tick nudge", async () => {
    const code = await setupStartedRoom();
    const store = globalThis.__mbStore as MemoryStore;
    const room = await store.getRoomByCode(code);
    const match = await store.getActiveMatch(room!.id);
    // force the deadline into the past
    await store.applyMatchUpdate(match!.id, match!.version, {
      version: match!.version + 1,
      phase: match!.phase,
      publicState: match!.publicState,
      timer: { endsAt: Date.now() - 1000, kind: "turn", durationMs: 30_000 },
      events: [],
      actorSeat: "system",
    });
    await applyAction(code, P2, { type: "__tick__" });
    const snap = await snapshotFor(code, HOST);
    const pub = snap.match?.publicState as { active: number };
    expect(pub.active).toBe(1); // timeout passed the turn to seat 1
  });

  it("kicks a player mid-game, marks abandoned, and lets a bot cover", async () => {
    const code = await setupStartedRoom();
    await kickSeat(code, HOST, 1);
    const snap = await snapshotFor(code, HOST);
    const seat1 = snap.room.seats.find((s) => s.seatIndex === 1);
    expect(seat1?.abandoned).toBe(true);

    // host plays; turn goes to abandoned seat 1; bot should auto-pass to seat 2
    await applyAction(code, HOST, { type: "add" });
    const after = await snapshotFor(code, HOST);
    const pub = after.match?.publicState as { active: number };
    expect(pub.active).toBe(2);
  });

  it("clears abandoned on presenceOpen so a disconnect-grace reconnect (not just an explicit rejoin) stops bot coverage", async () => {
    const code = await setupStartedRoom();
    const store = globalThis.__mbStore as MemoryStore;
    const room = await store.getRoomByCode(code);
    await store.updateSeat(room!.id, 1, {
      abandoned: true,
      connected: false,
      disconnectedAt: Date.now(),
    });
    const disconnected = await snapshotFor(code, HOST);
    expect(disconnected.room.seats.find((s) => s.seatIndex === 1)?.abandoned).toBe(true);

    // P2 simply reopens the room (SSE reconnect) rather than an explicit /join.
    await presenceOpen(code, P2);

    const after = await snapshotFor(code, HOST);
    const seat1 = after.room.seats.find((s) => s.seatIndex === 1);
    expect(seat1?.abandoned).toBe(false);
    expect(seat1?.connected).toBe(true);
  });

  it("does NOT let a kicked player's own reconnect (presenceOpen) undo the kick", async () => {
    const code = await setupStartedRoom();
    await kickSeat(code, HOST, 1);
    const kicked = await snapshotFor(code, HOST);
    const kickedSeat = kicked.room.seats.find((s) => s.seatIndex === 1);
    expect(kickedSeat?.abandoned).toBe(true);

    // P2 (the kicked player) simply reopens the room — this must not restore
    // their seat; only a fresh join by a new identity may refill it.
    await presenceOpen(code, P2);

    const after = await snapshotFor(code, HOST);
    const seat1 = after.room.seats.find((s) => s.seatIndex === 1);
    expect(seat1?.abandoned).toBe(true);
    expect(seat1?.connected).toBe(false);

    // Nor can the kicked uid regain control by simply submitting an action.
    await expect(applyAction(code, P2, { type: "add" })).rejects.toMatchObject({ code: "kicked" });

    // Nor via a non-fresh /join replay with the same uid.
    const rejoin = await joinRoom(code, {
      uid: P2,
      fresh: false,
      name: "Bo",
      avatarId: "cat",
      role: "player",
    });
    const seat1AfterRejoin = rejoin.snapshot.room.seats.find((s) => s.seatIndex === 1);
    expect(seat1AfterRejoin?.abandoned).toBe(true);
  });

  it("transfers host explicitly and rejects non-host control actions", async () => {
    const code = await setupStartedRoom();
    await expect(transferHost(code, P2, 2)).rejects.toMatchObject({ code: "not_host" });
    await transferHost(code, HOST, 1);
    const snap = await snapshotFor(code, HOST);
    expect(snap.room.hostSeat).toBe(1);
  });

  it("mid-game join replaces an abandoned seat when the game allows it", async () => {
    const code = await setupStartedRoom();
    await leaveRoom(code, P3);
    const joined = await joinRoom(code, {
      uid: "uid-new",
      fresh: false,
      name: "Dax",
      avatarId: "bee",
      role: "player",
    });
    expect(joined.snapshot.you.seatIndex).toBe(2);
    const seat = joined.snapshot.room.seats.find((s) => s.seatIndex === 2);
    expect(seat?.abandoned).toBe(false);
    expect(seat?.displayName).toBe("Dax");
  });

  it("publishes room/match/private messages with seat-scoped privacy", async () => {
    freshStore();
    const store = globalThis.__mbStore as MemoryStore;
    const { code } = await createRoom(HOST, "Ana", "fox");
    const seen: RoomMessage[] = [];
    store.subscribe(code, (m) => seen.push(m));
    await joinRoom(code, { uid: P2, fresh: false, name: "Bo", avatarId: "cat", role: "player" });
    await updateRoomSettings(code, HOST, { gameId: "testgame" });
    await startMatch(code, HOST);

    const kinds = seen.map((m) => m.kind);
    expect(kinds).toContain("room");
    expect(kinds).toContain("match");
    const privates = seen.filter((m) => m.kind === "private");
    expect(new Set(privates.map((m) => (m.kind === "private" ? m.seat : -1)))).toEqual(new Set([0, 1]));
  });

  it("sweeps idle rooms into expiry", async () => {
    freshStore();
    const store = globalThis.__mbStore as MemoryStore;
    const { code } = await createRoom(HOST, "Ana", "fox");
    const room = await store.getRoomByCode(code);
    await store.updateRoom(room!.id, { expiresAt: Date.now() - 1 });
    await sweepAll();
    const after = await store.getRoomByCode(code);
    expect(after?.status).toBe("expired");
  });

  it("rejects createPack for a caller with no seat or spectator slot in the given room", async () => {
    freshStore();
    const { code } = await createRoom(HOST, "Ana", "fox");

    const pack = await createPack(code, HOST, "testgame", "Family Pack", "en", { prompts: ["hi"] });
    expect(pack.title).toBe("Family Pack");

    await expect(
      createPack(code, "uid-not-in-room", "testgame", "Evil Pack", "en", { prompts: ["hax"] })
    ).rejects.toMatchObject({ code: "not_seated" });
  });
});
