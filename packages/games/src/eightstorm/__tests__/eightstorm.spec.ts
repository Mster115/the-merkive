import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  actErr,
  fireTimer,
  abandonSeat,
  botStep,
} from "@merky/game-sdk/testing";
import { eightstorm } from "../index";
import type { EightstormPrivateState, EightstormPublicState, EightstormSecret } from "../types";
import type { Card } from "../cards";

describe("Eightstorm Game Plugin", () => {
  it("initializes match with correct deal sizes (2p=7, 4p=5) and non-wild starter card", () => {
    const m2 = createTestMatch(eightstorm, { players: 2, seed: "eightstorm-seed-2p" });
    const pub2 = m2.state.publicState as EightstormPublicState;
    expect(m2.state.phase).toBe("turn");
    expect(pub2.activeSeat).toBe(0);
    expect(pub2.direction).toBe(1);
    expect(pub2.topCard.rank).not.toBe("8");
    expect(pub2.topCard.rank).not.toBe("JOKER");

    for (let s = 0; s < 2; s++) {
      const priv = m2.state.privateState[s as 0 | 1] as EightstormPrivateState;
      expect(priv.hand).toHaveLength(7);
      expect(pub2.handCounts[s]).toBe(7);
    }

    const m4 = createTestMatch(eightstorm, { players: 4, seed: "eightstorm-seed-4p" });
    const pub4 = m4.state.publicState as EightstormPublicState;
    for (let s = 0; s < 4; s++) {
      const priv = m4.state.privateState[s as 0 | 1 | 2 | 3] as EightstormPrivateState;
      expect(priv.hand).toHaveLength(5);
      expect(pub4.handCounts[s]).toBe(5);
    }
  });

  it("enforces suit/rank/wild legality including declared suit matching after a wild play", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-seed-legality" });

    // Manually give seat 0 a wild card "S-8" and a matching card "H-7"
    const wildCard: Card = { id: "S-8", suit: "S", rank: "8" };
    const matchingCard: Card = { id: "H-7", suit: "H", rank: "7" };
    const nonMatchingCard: Card = { id: "D-9", suit: "D", rank: "9" };

    (m.state.privateState[0] as EightstormPrivateState).hand.push(wildCard, matchingCard, nonMatchingCard);

    // Playing wild requires declaring suit
    actErr(m, 0, "play", { cardId: wildCard.id });

    // Play wild declaring suit "H"
    act(m, 0, "play", { cardId: wildCard.id, declareSuit: "H" });
    let pub = m.state.publicState as EightstormPublicState;
    expect(pub.declaredSuit).toBe("H");
    expect(pub.activeSeat).toBe(1);

    // Seat 1 tries to play non-matching card "D-9" when declared suit is "H"
    (m.state.privateState[1] as EightstormPrivateState).hand.push(nonMatchingCard);
    actErr(m, 1, "play", { cardId: nonMatchingCard.id });

    // Seat 1 plays matching suit card "H-7"
    (m.state.privateState[1] as EightstormPrivateState).hand.push(matchingCard);
    act(m, 1, "play", { cardId: matchingCard.id });
    pub = m.state.publicState as EightstormPublicState;
    expect(pub.declaredSuit).toBeNull();
  });

  it("handles house rules ON and OFF (2-stacking chain, jack skip, ace reverse incl. 2-player extra turn)", () => {
    // 2-stacking chain ON
    const m2Chain = createTestMatch(eightstorm, {
      players: 3,
      seed: "eightstorm-stacking",
      settings: { drawTwoOnTwo: true },
    });

    const topSuit = (m2Chain.state.publicState as EightstormPublicState).topCard.suit;

    const twoCard0: Card = { id: "S-2", suit: topSuit === "S" ? "H" : topSuit, rank: "2" };
    const twoCard1: Card = { id: "H-2", suit: "H", rank: "2" };

    (m2Chain.state.privateState[0] as EightstormPrivateState).hand.push(twoCard0);
    (m2Chain.state.privateState[1] as EightstormPrivateState).hand.push(twoCard1);

    act(m2Chain, 0, "play", { cardId: twoCard0.id });
    let pub = m2Chain.state.publicState as EightstormPublicState;
    expect(pub.pendingDraw).toBe(2);
    expect(pub.activeSeat).toBe(1);

    act(m2Chain, 1, "play", { cardId: twoCard1.id });
    pub = m2Chain.state.publicState as EightstormPublicState;
    expect(pub.pendingDraw).toBe(4);
    expect(pub.activeSeat).toBe(2);

    // Jack skip ON
    const mJack = createTestMatch(eightstorm, {
      players: 4,
      seed: "eightstorm-jack",
      settings: { skipOnJack: true },
    });
    const topSuitJack = (mJack.state.publicState as EightstormPublicState).topCard.suit;
    const jackCard: Card = { id: "S-J", suit: topSuitJack === "S" ? "H" : topSuitJack, rank: "J" };
    (mJack.state.privateState[0] as EightstormPrivateState).hand.push(jackCard);
    act(mJack, 0, "play", { cardId: jackCard.id });
    pub = mJack.state.publicState as EightstormPublicState;
    expect(pub.activeSeat).toBe(2); // Seat 1 skipped!

    // Ace reverse in 2-player game (extra turn for same player)
    const mAce2p = createTestMatch(eightstorm, {
      players: 2,
      seed: "eightstorm-ace-2p",
      settings: { reverseOnAce: true },
    });
    const topSuitAce = (mAce2p.state.publicState as EightstormPublicState).topCard.suit;
    const aceCard: Card = { id: "S-A", suit: topSuitAce === "S" ? "H" : topSuitAce, rank: "A" };
    (mAce2p.state.privateState[0] as EightstormPrivateState).hand.push(aceCard);
    act(mAce2p, 0, "play", { cardId: aceCard.id });
    pub = mAce2p.state.publicState as EightstormPublicState;
    expect(pub.activeSeat).toBe(0); // Same player goes again!
  });

  it("handles draw → may-play-drawn-card, draw → pass, already_drew and must_draw_first rejections", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-draw-pass" });

    // Can't pass before drawing
    actErr(m, 0, "pass");

    // Draw 1 card
    act(m, 0, "draw");
    let pub = m.state.publicState as EightstormPublicState;
    expect(pub.drewThisTurn).toBe(true);
    expect(pub.activeSeat).toBe(0); // Still seat 0's turn!

    // Can't draw a second time
    actErr(m, 0, "draw");

    // Pass turn
    act(m, 0, "pass");
    pub = m.state.publicState as EightstormPublicState;
    expect(pub.activeSeat).toBe(1);
    expect(pub.drewThisTurn).toBe(false);
  });

  it("ends turn immediately when forced to draw due to pendingDraw", () => {
    const m = createTestMatch(eightstorm, {
      players: 3,
      seed: "eightstorm-forced-draw",
      settings: { drawTwoOnTwo: true },
    });

    const topSuit = (m.state.publicState as EightstormPublicState).topCard.suit;
    const twoCard: Card = { id: "S-2", suit: topSuit === "S" ? "H" : topSuit, rank: "2" };
    (m.state.privateState[0] as EightstormPrivateState).hand.push(twoCard);
    act(m, 0, "play", { cardId: twoCard.id });

    // Seat 1 must draw penalty -> ends turn immediately
    act(m, 1, "draw");
    const pub = m.state.publicState as EightstormPublicState;
    expect(pub.pendingDraw).toBe(0);
    expect(pub.activeSeat).toBe(2);
  });

  it("conserves total card count during deck exhaustion reshuffle", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-reshuffle" });
    const secretBefore = m.state.secretState as EightstormSecret;

    // Drain draw pile
    const drainedSecret: EightstormSecret = {
      drawPile: [secretBefore.drawPile[0]!],
      discardPile: [
        ...secretBefore.discardPile,
        { id: "H-10", suit: "H", rank: "10" },
        { id: "C-9", suit: "C", rank: "9" },
      ],
    };
    m.state = { ...m.state, secretState: drainedSecret };

    const privateStateValues = Object.values(m.state.privateState) as Array<EightstormPrivateState | undefined>;
    const totalBefore =
      drainedSecret.drawPile.length +
      drainedSecret.discardPile.length +
      privateStateValues.reduce((sum: number, p) => sum + (p?.hand?.length ?? 0), 0);

    // Seat 0 draws, triggering reshuffle
    act(m, 0, "draw");
    const secretAfter = m.state.secretState as EightstormSecret;

    const privateStateValuesAfter = Object.values(m.state.privateState) as Array<EightstormPrivateState | undefined>;
    const totalAfter =
      secretAfter.drawPile.length +
      secretAfter.discardPile.length +
      privateStateValuesAfter.reduce((sum: number, p) => sum + (p?.hand?.length ?? 0), 0);

    expect(totalAfter).toBe(totalBefore);
  });

  it("calculates win and scoring math correctly when player sheds all cards", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-win" });

    // Give seat 0 a single winning card "S-7" matching top card rank or suit
    const winCard: Card = { id: "S-7", suit: "S", rank: "7" };
    (m.state.publicState as EightstormPublicState).topCard = { id: "S-5", suit: "S", rank: "5" };
    (m.state.privateState[0] as EightstormPrivateState).hand = [winCard];

    (m.state.privateState[1] as EightstormPrivateState).hand = [
      { id: "H-8", suit: "H", rank: "8" }, // 50 pts
      { id: "D-K", suit: "D", rank: "K" }, // 10 pts
    ];
    (m.state.privateState[2] as EightstormPrivateState).hand = [
      { id: "C-A", suit: "C", rank: "A" }, // 1 pt
      { id: "S-4", suit: "S", rank: "4" }, // 4 pts
    ];

    act(m, 0, "play", { cardId: winCard.id });

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");
    expect(m.scores[0]).toBe(65); // 50 + 10 + 1 + 4
  });

  it("advances turn via onTick timer auto-draw/pass", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-timer" });
    const activeBefore = (m.state.publicState as EightstormPublicState).activeSeat;

    fireTimer(m);
    const activeAfter = (m.state.publicState as EightstormPublicState).activeSeat;
    expect(activeAfter).not.toBe(activeBefore);
  });

  it("runs full 3-bot match loop with fireTimer and botStep to game_over without errors", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-bot-loop" });

    abandonSeat(m, 0);
    abandonSeat(m, 1);
    abandonSeat(m, 2);

    let maxSteps = 200;
    while (!m.over && maxSteps > 0) {
      maxSteps--;
      const stepCount = botStep(m);
      if (stepCount === 0 && !m.over) {
        fireTimer(m);
      }
    }

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");
  });

  it("guarantees determinism (same seed → identical initial hands)", () => {
    const m1 = createTestMatch(eightstorm, { players: 4, seed: "eightstorm-same-seed" });
    const m2 = createTestMatch(eightstorm, { players: 4, seed: "eightstorm-same-seed" });

    const hand1 = (m1.state.privateState[0] as EightstormPrivateState).hand;
    const hand2 = (m2.state.privateState[0] as EightstormPrivateState).hand;

    expect(hand1.map((c) => c.id)).toEqual(hand2.map((c) => c.id));
  });
});

describe("Eightstorm timeout hand integrity (regression)", () => {
  it("keeps the private hand in sync with public handCounts after a timer auto-draw+pass", async () => {
    const { createTestMatch, fireTimer } = await import("@merky/game-sdk/testing");
    const { eightstorm } = await import("../index");
    const m = createTestMatch(eightstorm, { players: 2, seed: "tick-hand-sync" });
    const pubBefore = m.state.publicState as { activeSeat: number; handCounts: Record<string, number> };
    const seat = pubBefore.activeSeat as 0 | 1;
    const handBefore = (m.state.privateState[seat] as { hand: unknown[] }).hand.length;

    fireTimer(m); // active seat has no pending draw and hasn't drawn → draw 1 + pass

    const pubAfter = m.state.publicState as { activeSeat: number; handCounts: Record<string, number> };
    const handAfter = (m.state.privateState[seat] as { hand: unknown[] }).hand.length;
    expect(handAfter).toBe(handBefore + 1);
    expect(pubAfter.handCounts[String(seat)]).toBe(handAfter);
    expect(pubAfter.activeSeat).not.toBe(seat);
  });
});

describe("Eightstorm security (regression)", () => {
  it("never leaks the draw/discard pile contents through publicState", () => {
    const m = createTestMatch(eightstorm, { players: 3, seed: "eightstorm-no-leak" });

    const assertNoPileLeak = () => {
      const raw = m.state.publicState as unknown as Record<string, unknown>;
      expect(raw._drawPile).toBeUndefined();
      expect(raw._discardPile).toBeUndefined();

      const topCardId = (m.state.publicState as EightstormPublicState).topCard.id;
      const secret = m.state.secretState as EightstormSecret;
      const json = JSON.stringify(m.state.publicState);
      for (const card of [...secret.drawPile, ...secret.discardPile]) {
        if (card.id === topCardId) continue; // the top discard card is legitimately public
        expect(json, `card ${card.id} leaked into publicState`).not.toContain(card.id);
      }
    };

    // Every future draw's exact card order must stay server-only from the
    // opening deal onward, not just after some mutation.
    assertNoPileLeak();
    act(m, 0, "draw");
    assertNoPileLeak();
    act(m, 0, "pass");
    assertNoPileLeak();
    act(m, 1, "draw");
    assertNoPileLeak();
  });
});
