import { beforeEach, describe, expect, it } from "vitest";
import { defineGame, type SeatIndex } from "@merky/game-sdk";
import { gameRegistry } from "@merky/games";
import type { RoomMessage } from "@/shared/messages";
import { MemoryStore } from "../store/memory";
import { applyAction, createRoom, joinRoom, startMatch, updateRoomSettings } from "../service";

/**
 * Proves the `ReduceResult.events` contract end-to-end through the real
 * service → runtime → store pipeline. The SDK always documented events as
 * "broadcast to clients for toasts/animations", but nothing carried them to
 * a game's UI: they were published on the realtime message and dropped.
 *
 * The delivery has two halves that must agree:
 *   - everyone else gets them on the published `match` message;
 *   - the actor gets them on their own action response, because they jump
 *     straight to the final version and their version gate would otherwise
 *     discard the realtime copy carrying the events.
 *
 * Includes the no-leak gate: events are a client-bound surface, so nothing
 * secret may ride along on them.
 */

const SECRET_MARKER = "EVENT_SECRET_MARKER_XYZZY";

const eventGame = defineGame({
  meta: {
    id: "eventtest",
    nameKey: "games.eventtest.name",
    descriptionKey: "games.eventtest.description",
    minPlayers: 2,
    maxPlayers: 8,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["test"],
    defaultSettings: {},
    settingFields: [],
  },
  i18n: {
    en: {
      "games.eventtest.name": "Event Exerciser",
      "games.eventtest.description": "Platform events pipeline test",
    },
  },
  init(ctx) {
    return {
      publicState: { plays: 0, timerFired: false },
      privateState: Object.fromEntries(ctx.seats.map((s) => [s.seatIndex, { n: 0 }])),
      secretState: { marker: SECRET_MARKER },
      phase: "playing",
      events: [{ type: "game_started" }],
    };
  },
  reduce(_ctx, state, action) {
    const pub = state.publicState as { plays: number; timerFired: boolean };
    const seat = action.seat as SeatIndex;

    if (action.type === "play") {
      return {
        publicState: { ...pub, plays: pub.plays + 1 },
        privateState: { [seat]: { n: pub.plays + 1 } },
        phase: "playing",
        events: [{ type: "commit", payload: { seat } }],
      };
    }
    // Leaves a due timer behind so the next action cascades through onTick,
    // which emits its own event from a *different* version than the action.
    if (action.type === "arm") {
      return {
        publicState: { ...pub },
        phase: "playing",
        timer: { kind: "turn", endsAt: Date.now() - 1, durationMs: 1 },
        events: [{ type: "armed" }],
      };
    }
    if (action.type === "silent") {
      return { publicState: { ...pub }, phase: "playing", events: [] };
    }
    return { error: "unknown", code: "unknown_action" };
  },
  onTick(_ctx, state) {
    const pub = state.publicState as { plays: number; timerFired: boolean };
    if (pub.timerFired) return null;
    return {
      publicState: { ...pub, timerFired: true },
      phase: "playing",
      timer: null,
      events: [{ type: "timer_expired" }],
    };
  },
  awaitedSeats() {
    return [];
  },
  ui: { Stage: () => null, Controller: () => null },
});

const HOST = "uid-host";
const P2 = "uid-p2";

async function setup() {
  const store = new MemoryStore();
  globalThis.__mbStore = store;
  globalThis.__mbSweeper ??= setInterval(() => undefined, 1 << 30);

  const created = await createRoom(HOST, "Ana", "fox");
  const code = created.code;
  await joinRoom(code, { uid: P2, fresh: false, name: "Bo", avatarId: "cat", role: "player" });
  await updateRoomSettings(code, HOST, { gameId: "eventtest", settings: {} });

  const published: RoomMessage[] = [];
  store.subscribe?.(code, (msg) => published.push(msg));
  await startMatch(code, HOST);
  return { store, code, published };
}

const matchEvents = (published: RoomMessage[]) =>
  published.filter((m): m is Extract<RoomMessage, { kind: "match" }> => m.kind === "match");

describe("game events platform contract", () => {
  beforeEach(() => {
    gameRegistry["eventtest"] = eventGame;
  });

  it("returns the acting seat's events on their own action response", async () => {
    const { code } = await setup();
    const res = await applyAction(code, HOST, { type: "play" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.events).toEqual([{ type: "commit", payload: { seat: 0 } }]);
  });

  it("publishes the same events to everyone else on the match message", async () => {
    const { code, published } = await setup();
    published.length = 0;
    await applyAction(code, HOST, { type: "play" });

    const events = matchEvents(published).flatMap((m) => m.events);
    expect(events).toEqual([{ type: "commit", payload: { seat: 0 } }]);
  });

  it("gives the actor the cascaded system events their version gate would have eaten", async () => {
    const { code, published } = await setup();
    published.length = 0;
    // Arming leaves an already-due timer, so the runtime's trailing
    // advanceSystem fires onTick within this same request. That event lands on
    // a *later version* than the player's own step — the actor jumps straight
    // to the final version, so without collecting it their gate would drop
    // the realtime copy and the FX would never play for them.
    const res = await applyAction(code, HOST, { type: "arm" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const types = (res.events ?? []).map((e) => e.type);
    expect(types).toEqual(["armed", "timer_expired"]);

    // Two separate published versions carried them to everyone else.
    const msgs = matchEvents(published);
    expect(msgs.map((m) => m.events.map((e) => e.type))).toEqual([["armed"], ["timer_expired"]]);
    expect(msgs[1]!.match.version).toBeGreaterThan(msgs[0]!.match.version);
  });

  it("reports an empty list for a step that emitted nothing", async () => {
    const { code } = await setup();
    const res = await applyAction(code, HOST, { type: "silent" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.events).toEqual([]);
  });

  it("hands a rejected action no events at all", async () => {
    const { code } = await setup();
    const res = await applyAction(code, HOST, { type: "bogus" });
    expect(res).toEqual({ ok: false, code: "unknown_action", error: expect.any(String) });
  });

  /**
   * Events are a client-bound surface, so they get the same no-leak gate as
   * every published message: stringify everything a client can receive and
   * prove the server-only marker is absent.
   */
  it("never lets secretState ride along on an events-bearing surface", async () => {
    const { code, published } = await setup();
    published.length = 0;
    const res = await applyAction(code, HOST, { type: "play" });

    expect(JSON.stringify(res)).not.toContain(SECRET_MARKER);
    expect(JSON.stringify(published)).not.toContain(SECRET_MARKER);
    // ...and the actor's response carries only their own private state.
    if (!res.ok) return;
    expect(res.privateState).toEqual({ n: 1 });
  });
});
