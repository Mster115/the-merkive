import { describe, it, expect } from "vitest";
import type { GameContext, GameStateIn, SeatPublic } from "@merky/game-sdk";
import { initSecretMerk, reduceSecretMerk, awaitedSeatsSecretMerk } from "../logic";

function createDummyContext(seatCount = 5): GameContext {
  const seats: SeatPublic[] = Array.from({ length: seatCount }, (_, i) => ({
    seatIndex: i as any,
    displayName: `Player ${i + 1}`,
    avatarId: "fox",
    role: "player",
    connected: true,
    abandoned: false,
    isHost: i === 0,
  }));

  let seed = 42;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return {
    matchId: "m1",
    roomId: "r1",
    seats,
    settings: {},
    now: 1000,
    rng,
  };
}

describe("Secret Merk game logic", () => {
  it("initializes 5-player game with 1 Secret Merk, 1 Merker, and 3 Loyalists", () => {
    const ctx = createDummyContext(5);
    const init = initSecretMerk(ctx);
    const pub = init.publicState as any;
    const privs = init.privateState as Record<number, any>;

    expect(pub.phase).toBe("nominate");
    expect(pub.presidentSeat).toBe(0);
    expect(pub.loyalistPassed).toBe(0);
    expect(pub.merkerPassed).toBe(0);

    const roles = Object.values(pub._roles);
    expect(roles.filter((r) => r === "secret_merk").length).toBe(1);
    expect(roles.filter((r) => r === "merker").length).toBe(1);
    expect(roles.filter((r) => r === "loyalist").length).toBe(3);

    // In 5-player game, Secret Merk knows Merkers
    const secretMerkSeat = Number(Object.keys(pub._roles).find((s) => pub._roles[s] === "secret_merk"));
    expect(privs[secretMerkSeat]?.knownMerkers.length).toBe(2);
  });

  it("handles nomination, voting, and legislation cycle", () => {
    const ctx = createDummyContext(5);
    const init = initSecretMerk(ctx);
    let state: GameStateIn = {
      publicState: init.publicState,
      privateState: init.privateState as any,
      phase: init.phase,
    };

    // President 0 nominates Seat 1
    let res = reduceSecretMerk(ctx, state, {
      type: "nominate_chancellor",
      seat: 0 as any,
      payload: { nomineeSeat: 1 },
    });

    expect("error" in res).toBe(false);
    if (!("error" in res)) {
      state = { publicState: res.publicState, privateState: res.privateState as any, phase: res.phase };
      expect(state.phase).toBe("vote");
    }

    // All 5 players vote YES
    for (let i = 0; i < 5; i++) {
      res = reduceSecretMerk(ctx, state, {
        type: "vote",
        seat: i as any,
        payload: { vote: true },
      });
      if (!("error" in res)) {
        state = { publicState: res.publicState, privateState: res.privateState as any, phase: res.phase };
      }
    }

    expect(state.phase).toBe("legislative_president");

    // President discards index 0
    res = reduceSecretMerk(ctx, state, {
      type: "discard_president",
      seat: 0 as any,
      payload: { discardIndex: 0 },
    });
    if (!("error" in res)) {
      state = { publicState: res.publicState, privateState: res.privateState as any, phase: res.phase };
    }

    expect(state.phase).toBe("legislative_chancellor");

    // Chancellor enacts index 0
    res = reduceSecretMerk(ctx, state, {
      type: "enact_chancellor",
      seat: 1 as any,
      payload: { enactIndex: 0 },
    });
    if (!("error" in res)) {
      state = { publicState: res.publicState, privateState: res.privateState as any, phase: res.phase };
    }

    expect(state.phase).toBe("nominate");
    expect((state.publicState as any).presidentSeat).toBe(1);
  });

  it("correctly identifies awaited seats per phase", () => {
    const ctx = createDummyContext(5);
    const init = initSecretMerk(ctx);
    let state: GameStateIn = {
      publicState: init.publicState,
      privateState: init.privateState as any,
      phase: init.phase,
    };

    expect(awaitedSeatsSecretMerk(ctx, state)).toEqual([0]);

    const res = reduceSecretMerk(ctx, state, {
      type: "nominate_chancellor",
      seat: 0 as any,
      payload: { nomineeSeat: 1 },
    });
    if (!("error" in res)) {
      state = { publicState: res.publicState, privateState: res.privateState as any, phase: res.phase };
    }

    expect(awaitedSeatsSecretMerk(ctx, state)).toEqual([0, 1, 2, 3, 4]);
  });
});
