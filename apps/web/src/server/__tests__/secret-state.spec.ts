import { beforeEach, describe, expect, it } from "vitest";
import { defineGame, type SeatIndex } from "@merky/game-sdk";
import { gameRegistry } from "@merky/games";
import type { RoomMessage } from "@/shared/messages";
import { MemoryStore } from "../store/memory";
import { applyAction, createRoom, joinRoom, snapshotFor, startMatch, updateRoomSettings } from "../service";

/**
 * Proves the secretState contract end-to-end through the real service →
 * runtime → store pipeline: games can keep server-only state that (a) is
 * persisted and threaded back into reduce, (b) follows omit-keeps /
 * present-replaces semantics, and (c) NEVER appears in any client-bound
 * surface — snapshots, match views, or published room messages.
 */

const MARKER = "TOP_SECRET_MARKER_XYZZY";

interface SecretDeck {
  marker: string;
  deck: string[];
}

const secretGame = defineGame({
  meta: {
    id: "secrettest",
    nameKey: "games.secrettest.name",
    descriptionKey: "games.secrettest.description",
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
      "games.secrettest.name": "Secret State Exerciser",
      "games.secrettest.description": "Platform secretState pipeline test",
    },
  },
  init(ctx) {
    const secret: SecretDeck = {
      marker: MARKER,
      deck: ["CARD_ALPHA", "CARD_BRAVO", "CARD_CHARLIE"],
    };
    return {
      publicState: { drawn: 0 },
      privateState: Object.fromEntries(ctx.seats.map((s) => [s.seatIndex, { hand: [] as string[] }])),
      secretState: secret,
      phase: "playing",
      events: [],
    };
  },
  reduce(_ctx, state, action) {
    const pub = state.publicState as { drawn: number };
    const secret = state.secretState as SecretDeck | null | undefined;

    if (action.type === "draw") {
      if (!secret || secret.marker !== MARKER) {
        return { error: "secret state missing in reduce", code: "secret_missing" };
      }
      const [top, ...rest] = secret.deck;
      if (top === undefined) return { error: "deck empty", code: "deck_empty" };
      const seat = action.seat as SeatIndex;
      const priv = (state.privateState[seat] as { hand: string[] } | undefined) ?? { hand: [] };
      return {
        publicState: { drawn: pub.drawn + 1 },
        privateState: { [seat]: { hand: [...priv.hand, top] } },
        secretState: { ...secret, deck: rest },
        phase: "playing",
        events: [{ type: "drew" }],
      };
    }
    if (action.type === "noop") {
      // Omits secretState entirely — platform must keep the previous value.
      return { publicState: { ...pub }, phase: "playing", events: [] };
    }
    if (action.type === "wipe") {
      // Explicit null must replace (clear) the stored secret.
      return { publicState: { ...pub }, secretState: null, phase: "playing", events: [] };
    }
    return { error: "unknown", code: "unknown_action" };
  },
  awaitedSeats() {
    return [];
  },
  ui: { Stage: () => null, Controller: () => null },
});

const HOST = "uid-host";
const P2 = "uid-p2";

function freshStore(): MemoryStore {
  const store = new MemoryStore();
  globalThis.__mbStore = store;
  globalThis.__mbSweeper ??= setInterval(() => undefined, 1 << 30);
  return store;
}

async function setup() {
  const store = freshStore();
  const created = await createRoom(HOST, "Ana", "fox");
  const code = created.code;
  await joinRoom(code, { uid: P2, fresh: false, name: "Bo", avatarId: "cat", role: "player" });
  await updateRoomSettings(code, HOST, { gameId: "secrettest", settings: {} });

  const published: RoomMessage[] = [];
  store.subscribe?.(code, (msg) => published.push(msg));

  await startMatch(code, HOST);
  const room = await store.getRoomByCode(code);
  const match = await store.getActiveMatch(room!.id);
  return { store, code, roomId: room!.id, matchId: match!.id, published };
}

describe("secretState platform contract", () => {
  beforeEach(() => {
    gameRegistry["secrettest"] = secretGame;
  });

  it("persists secretState from init and threads it into reduce", async () => {
    const { store, code, roomId, matchId } = await setup();
    const rec = await store.getMatch(matchId);
    expect((rec?.secretState as SecretDeck).marker).toBe(MARKER);
    expect((rec?.secretState as SecretDeck).deck).toHaveLength(3);

    // draw depends on secretState being fed back into reduce — and on the
    // mutated value persisting between calls.
    const r1 = await applyAction(code, HOST, { type: "draw" });
    expect(r1).toMatchObject({ ok: true });
    const r2 = await applyAction(code, P2, { type: "draw" });
    expect(r2).toMatchObject({ ok: true });

    const after = await store.getMatch(matchId);
    expect((after?.secretState as SecretDeck).deck).toEqual(["CARD_CHARLIE"]);
    const active = await store.getActiveMatch(roomId);
    expect((active?.privateState[0] as { hand: string[] }).hand).toEqual(["CARD_ALPHA"]);
    expect((active?.privateState[1] as { hand: string[] }).hand).toEqual(["CARD_BRAVO"]);
  });

  it("omitting secretState keeps it; explicit null clears it", async () => {
    const { store, code, matchId } = await setup();
    await applyAction(code, HOST, { type: "noop" });
    let rec = await store.getMatch(matchId);
    expect((rec?.secretState as SecretDeck).marker).toBe(MARKER);

    await applyAction(code, HOST, { type: "wipe" });
    rec = await store.getMatch(matchId);
    expect(rec?.secretState).toBeNull();
  });

  it("never leaks secretState into snapshots or any published message", async () => {
    const { code, published } = await setup();
    await applyAction(code, HOST, { type: "draw" });
    await applyAction(code, P2, { type: "draw" });

    for (const uid of [HOST, P2, null]) {
      const snap = await snapshotFor(code, uid);
      const raw = JSON.stringify(snap);
      expect(raw).not.toContain(MARKER);
      expect(raw).not.toContain("CARD_CHARLIE"); // still in the hidden deck
      expect(raw).not.toContain("secretState");
    }

    expect(published.length).toBeGreaterThan(0);
    for (const msg of published) {
      const raw = JSON.stringify(msg);
      expect(raw).not.toContain(MARKER);
      expect(raw).not.toContain("secretState");
      if (msg.kind === "match") {
        expect(raw).not.toContain("CARD_"); // no card ever rides a public patch
      }
      if (msg.kind === "private") {
        // A seat's private message may contain that seat's own drawn card,
        // but never the undrawn deck.
        expect(raw).not.toContain("CARD_CHARLIE");
      }
    }
  });

  it("own-seat snapshot still delivers that seat's private state (sanity)", async () => {
    const { code } = await setup();
    await applyAction(code, HOST, { type: "draw" });
    const snap = await snapshotFor(code, HOST);
    expect(JSON.stringify(snap.you.privateState)).toContain("CARD_ALPHA");
  });
});
