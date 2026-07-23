import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  actErr,
  fireTimer,
  abandonSeat,
  botStep,
  type TestMatch,
} from "@merky/game-sdk/testing";
import type { GameContext, SeatIndex } from "@merky/game-sdk";
import { merkissioner } from "../index";
import { totalCards } from "../deck";
import { boardFor, roleCountsFor } from "../roles";
import { nextLivingSeat, validateNominateTarget } from "../helpers";
import type {
  Decree,
  MerkissionerPrivateState,
  MerkissionerPublicState,
  MerkissionerSecret,
  Role,
} from "../types";

/** Minimal fake GameContext for unit-testing pure validators directly (no rng/settings needed by them). */
function fakeCtx(playerCount: number): GameContext {
  return {
    matchId: "test-match",
    roomId: "test-room",
    seats: Array.from({ length: playerCount }, (_, i) => ({
      seatIndex: i as SeatIndex,
      displayName: `P${i}`,
      avatarId: "fox",
      role: "player" as const,
      connected: true,
      abandoned: false,
      isHost: i === 0,
    })),
    settings: {},
    now: 0,
    rng: () => 0.5,
  };
}

/** Minimal valid MerkissionerPublicState, for unit-testing pure validators in isolation. */
function basePublicState(overrides: Partial<MerkissionerPublicState>): MerkissionerPublicState {
  return {
    playerCount: 6,
    board: "5-6",
    merkizenEnacted: 0,
    merkiteEnacted: 0,
    gridlock: 0,
    drawCount: 17,
    discardCount: 0,
    readySeats: [],
    banishedSeats: [],
    auditedSeats: [],
    chairSeat: 0 as SeatIndex,
    nomineeSeat: null,
    commissionerSeat: null,
    lastChairSeat: null,
    lastCommissionerSeat: null,
    rotationAnchorSeat: 0 as SeatIndex,
    pendingSnapTarget: null,
    votedSeats: [],
    vetoRefusedThisSession: false,
    activePower: null,
    roundNumber: 1,
    lastVote: null,
    lastEnacted: null,
    lastAudit: null,
    lastPeekBy: null,
    lastSnap: null,
    lastBanish: null,
    anarchyCount: 0,
    winnerTeam: null,
    winReason: null,
    revealedRoles: null,
    _totals: {},
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function pub(m: TestMatch): MerkissionerPublicState {
  return m.state.publicState as MerkissionerPublicState;
}
function priv(m: TestMatch, seat: SeatIndex): MerkissionerPrivateState {
  return m.state.privateState[seat] as MerkissionerPrivateState;
}
function secret(m: TestMatch): MerkissionerSecret {
  return m.state.secretState as MerkissionerSecret;
}

function seatIndices(m: TestMatch): SeatIndex[] {
  return m.seats.map((s) => s.seatIndex);
}

function findSeatWithRole(m: TestMatch, role: Role): SeatIndex {
  for (const s of seatIndices(m)) {
    if (priv(m, s).role === role) return s;
  }
  throw new Error(`no seat with role ${role} found`);
}

/** Every one of the 17 decrees is always accounted for: draw + discard + top-stack + in-flight hands + enacted. */
function assertDeckConserved(m: TestMatch) {
  const p = pub(m);
  const hands: Decree[][] = [];
  for (const s of seatIndices(m)) {
    const h = priv(m, s)?.hand;
    if (h) hands.push(h);
  }
  expect(totalCards(secret(m), hands, p.merkizenEnacted, p.merkiteEnacted)).toBe(17);
}

/** publicState must never carry hidden information — only counts, seat lists, and post-game reveals. */
function assertPublicStateSafe(m: TestMatch) {
  const raw = pub(m) as unknown as Record<string, unknown>;
  for (const forbiddenKey of ["role", "roles", "deck", "draw", "discard", "topStack", "hand", "hands", "auditResults", "peek", "myVote"]) {
    expect(raw[forbiddenKey], `publicState must not carry "${forbiddenKey}"`).toBeUndefined();
  }
  if (m.state.phase !== "game_over") {
    expect(raw.revealedRoles).toBeNull();
    expect(raw.winnerTeam).toBeNull();
  }
  const json = JSON.stringify(raw);
  // Deck composition must never appear as concrete numbers-with-card-semantics; the only
  // "merkizen"/"merkite" strings allowed pre-game_over are the two enacted-count field
  // NAMES themselves (merkizenEnacted/merkiteEnacted) and the win-reason/team-safe strings.
  expect(json).not.toContain('"role":"merki');
}

/** Nominates the next legal target (skipping the boss if `avoidBoss` is set) and advances to `vote`. */
function nominateNext(m: TestMatch, chair: SeatIndex, opts?: { avoidSeat?: SeatIndex }): SeatIndex {
  const p = pub(m);
  const candidates = seatIndices(m).filter(
    (s) =>
      s !== chair &&
      !p.banishedSeats.includes(s) &&
      s !== p.lastCommissionerSeat &&
      !(s === p.lastChairSeat && seatIndices(m).filter((x) => !p.banishedSeats.includes(x)).length > 5) &&
      s !== opts?.avoidSeat
  );
  const target = candidates[0];
  if (target === undefined) throw new Error("no legal nominee available");
  act(m, chair, "nominate", { seat: target });
  return target;
}

/** All living seats vote the same way. */
function allVote(m: TestMatch, vote: "yeah" | "nah") {
  for (const s of seatIndices(m)) {
    if (pub(m).banishedSeats.includes(s)) continue;
    act(m, s, "cast_vote", { vote });
  }
}

/** Plays one full winning legislative session: Chair discards to keep `want`, Commissioner enacts `want`. Returns true if a power phase followed. */
function playLegislativeSession(m: TestMatch, want: Decree): boolean {
  const p = pub(m);
  const chairHand = priv(m, p.chairSeat).hand ?? [];
  const discardIdx = chairHand.findIndex((d) => d !== want);
  act(m, p.chairSeat, "discard_decree", { index: discardIdx >= 0 ? discardIdx : 0 });

  const p2 = pub(m);
  const commissioner = p2.commissionerSeat as SeatIndex;
  const commHand = priv(m, commissioner).hand ?? [];
  const enactIdx = commHand.findIndex((d) => d === want);
  act(m, commissioner, "enact_decree", { index: enactIdx >= 0 ? enactIdx : 0 });

  return m.state.phase.startsWith("power_");
}

/** Resolves whatever power phase is currently active, avoiding `avoidTarget` (e.g. the boss). */
function resolvePower(m: TestMatch, avoidTarget?: SeatIndex) {
  const p = pub(m);
  if (m.state.phase === "power_peek") {
    act(m, p.chairSeat, "use_power", {});
    return;
  }
  const target = seatIndices(m).find(
    (s) => s !== p.chairSeat && !p.banishedSeats.includes(s) && s !== avoidTarget
  ) as SeatIndex;
  act(m, p.chairSeat, "use_power", { seat: target });
}

/** Plays exactly one full round unconditionally (unlike `driveRoundsUntil`, which checks `stop()` before acting). */
function playOneRound(m: TestMatch, want: Decree, opts?: { avoidNominee?: SeatIndex; avoidPowerTarget?: SeatIndex }) {
  const chair = pub(m).chairSeat;
  nominateNext(m, chair, { avoidSeat: opts?.avoidNominee });
  allVote(m, "yeah");
  if (m.over) return;
  const wentToPower = playLegislativeSession(m, want);
  if (m.over) return;
  if (wentToPower) resolvePower(m, opts?.avoidPowerTarget);
}

/** Drives full rounds (nominate -> vote yeah -> legislative, enacting `want` whenever possible) until `stop()` is true. */
function driveRoundsUntil(
  m: TestMatch,
  want: Decree,
  stop: () => boolean,
  opts?: { avoidNominee?: SeatIndex; avoidPowerTarget?: SeatIndex; maxRounds?: number; stopBeforePower?: boolean }
) {
  const maxRounds = opts?.maxRounds ?? 80;
  for (let i = 0; i < maxRounds && !stop(); i++) {
    const chair = pub(m).chairSeat;
    nominateNext(m, chair, { avoidSeat: opts?.avoidNominee });
    allVote(m, "yeah");
    if (m.over) return;
    const wentToPower = playLegislativeSession(m, want);
    if (m.over) return;
    if (wentToPower) {
      // Let the caller resolve this specific power itself once its own stop condition is met.
      if (opts?.stopBeforePower && stop()) return;
      resolvePower(m, opts?.avoidPowerTarget);
      if (m.over) return;
    }
    assertDeckConserved(m);
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                                 */
/* ------------------------------------------------------------------ */

describe("init", () => {
  it("role distribution and knowledge rules hold for every player count 5..12", () => {
    for (let n = 5; n <= 12; n++) {
      const m = createTestMatch(merkissioner, { players: n, seed: `init-${n}` });
      const counts = roleCountsFor(n);
      const roleTally: Record<Role, number> = { merkizen: 0, merkite: 0, merkissioner: 0 };
      for (const s of seatIndices(m)) roleTally[priv(m, s).role] += 1;

      expect(roleTally.merkizen).toBe(counts.merkizen);
      expect(roleTally.merkite).toBe(counts.merkite);
      expect(roleTally.merkissioner).toBe(1);
      expect(pub(m).board).toBe(boardFor(n));

      const boss = findSeatWithRole(m, "merkissioner");
      const merkites = seatIndices(m).filter((s) => priv(m, s).role === "merkite");

      // Every Merkizen knows nothing.
      for (const s of seatIndices(m)) {
        if (priv(m, s).role === "merkizen") {
          expect(priv(m, s).knownMerkites).toEqual([]);
          expect(priv(m, s).knownBoss).toBeNull();
        }
      }
      // Every Merkite always knows the boss and their fellow Merkites (never themselves).
      for (const mk of merkites) {
        expect(priv(m, mk).knownBoss).toBe(boss);
        expect(priv(m, mk).knownMerkites.sort()).toEqual(merkites.filter((s) => s !== mk).sort());
      }
      // Boss: mutual knowledge at 5-6p, knows nobody at 7-8p.
      if (n <= 6) {
        expect(priv(m, boss).knownMerkites.sort()).toEqual([...merkites].sort());
      } else {
        expect(priv(m, boss).knownMerkites).toEqual([]);
      }
      expect(priv(m, boss).knownBoss).toBeNull();

      assertDeckConserved(m);
      assertPublicStateSafe(m);
    }
  });

  it("deck starts at 6 Merkizen + 11 Merkite in secretState (test-only access — never reaches any client)", () => {
    const m = createTestMatch(merkissioner, { players: 6, seed: "deck-init" });
    expect(secret(m)).toEqual({ draw: { merkizen: 6, merkite: 11 }, discard: { merkizen: 0, merkite: 0 }, topStack: [] });
  });

  it("SECURITY: publicState never leaks roles/deck/hands/votes/audit/peek data before game_over", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "security-init" });
    assertPublicStateSafe(m);
    // Every seat's private slice contains ONLY that seat's own legitimate knowledge.
    for (const s of seatIndices(m)) {
      const p = priv(m, s);
      expect(typeof p.role).toBe("string");
      expect(Array.isArray(p.knownMerkites)).toBe(true);
      expect(Array.isArray(p.auditResults)).toBe(true);
      expect(p.auditResults.length).toBe(0);
      expect(p.hand).toBeNull();
      expect(p.peek).toBeNull();
      expect(p.myVote).toBeNull();
    }
  });

  it("huddle starts with a 45s fixed timer regardless of pace, and everyone begins not-ready", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "huddle-init", settings: { pace: "speedy" } });
    expect(m.state.phase).toBe("huddle");
    expect(pub(m).readySeats).toEqual([]);
    expect(m.timer).toEqual({ endsAt: m.now + 45_000, kind: "huddle", durationMs: 45_000 });
  });
});

/* ------------------------------------------------------------------ */
/* Golden path                                                         */
/* ------------------------------------------------------------------ */

describe("golden path", () => {
  it("7p: huddle -> nominate -> vote pass -> legislative -> enact Merkizen x5 -> Merkizen win", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "golden-7p" });
    const boss = findSeatWithRole(m, "merkissioner");

    for (const s of seatIndices(m)) act(m, s, "ready_up");
    expect(m.state.phase).toBe("nominate");

    driveRoundsUntil(m, "merkizen", () => pub(m).merkizenEnacted >= 5, {
      avoidNominee: boss,
      avoidPowerTarget: boss,
    });

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");
    expect(pub(m).winnerTeam).toBe("merkizen");
    expect(pub(m).winReason).toBe("merkizen_decrees");
    expect(pub(m).merkizenEnacted).toBeGreaterThanOrEqual(5);
    expect(pub(m).revealedRoles?.[boss]).toBe("merkissioner");

    // Winning-team seats scored 100, losers 0 — cumulative, set exactly once.
    for (const s of seatIndices(m)) {
      const role = priv(m, s).role;
      const onWinningTeam = role !== "merkite" && role !== "merkissioner";
      expect(m.scores[s]).toBe(onWinningTeam ? 100 : 0);
    }
    assertDeckConserved(m);
  });

  it("determinism: replaying the same seed twice produces an identical public-state transcript", () => {
    function transcript(seed: string): string[] {
      const m = createTestMatch(merkissioner, { players: 6, seed });
      const out: string[] = [JSON.stringify(pub(m))];
      for (const s of seatIndices(m)) act(m, s, "ready_up");
      out.push(JSON.stringify(pub(m)));
      for (let i = 0; i < 6 && !m.over; i++) {
        const chair = pub(m).chairSeat;
        nominateNext(m, chair);
        allVote(m, "yeah");
        out.push(JSON.stringify(pub(m)));
        if (m.over) break;
        const wentToPower = playLegislativeSession(m, "merkizen");
        out.push(JSON.stringify(pub(m)));
        if (wentToPower && !m.over) {
          resolvePower(m);
          out.push(JSON.stringify(pub(m)));
        }
      }
      return out;
    }
    const a = transcript("determinism-seed-1");
    const b = transcript("determinism-seed-1");
    expect(a).toEqual(b);
  });
});

/* ------------------------------------------------------------------ */
/* Win conditions                                                       */
/* ------------------------------------------------------------------ */

describe("win conditions", () => {
  it("boss elected Commissioner with >=3 Merkite enacted -> Merkite win at vote reveal, no legislative session", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "boss-elected" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 3, {
      avoidNominee: boss,
      avoidPowerTarget: boss,
    });
    expect(m.over).toBe(false);
    expect(pub(m).merkiteEnacted).toBeGreaterThanOrEqual(3);

    const chair = pub(m).chairSeat;
    act(m, chair, "nominate", { seat: boss });
    allVote(m, "yeah");

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");
    expect(pub(m).winnerTeam).toBe("merkite");
    expect(pub(m).winReason).toBe("boss_elected");
    expect(pub(m).revealedRoles?.[boss]).toBe("merkissioner");
  });

  it("banishing the boss -> Merkizen win (boss_banished) even mid-Merkite-track", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "banish-boss" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    // 5-6p board: banish unlocks on the 4th and 5th Merkite decree.
    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_banish", {
      avoidNominee: boss,
      stopBeforePower: true,
    });
    expect(m.state.phase).toBe("power_banish");

    const chairSeat = pub(m).chairSeat;
    act(m, chairSeat, "use_power", { seat: boss });

    expect(m.over).toBe(true);
    expect(pub(m).winReason).toBe("boss_banished");
    expect(pub(m).winnerTeam).toBe("merkizen");
    expect(pub(m).revealedRoles?.[boss]).toBe("merkissioner");
  });

  it("6 Merkite decrees enacted -> Merkite win (merkite_decrees)", () => {
    const m = createTestMatch(merkissioner, { players: 8, seed: "six-merkite" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 6, {
      avoidNominee: boss,
      avoidPowerTarget: boss,
      maxRounds: 100,
    });

    expect(m.over).toBe(true);
    expect(pub(m).winnerTeam).toBe("merkite");
    expect(pub(m).winReason).toBe("merkite_decrees");
    expect(pub(m).merkiteEnacted).toBe(6);
    for (const s of seatIndices(m)) {
      const role = priv(m, s).role;
      const onWinningTeam = role === "merkite" || role === "merkissioner";
      expect(m.scores[s]).toBe(onWinningTeam ? 100 : 0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* MERKY ANARCHY                                                        */
/* ------------------------------------------------------------------ */

describe("MERKY ANARCHY", () => {
  it("3 failed votes -> chaos top-deck enact, gridlock resets, term limits clear, and play resumes at nominate", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "anarchy-1" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    const chair1 = pub(m).chairSeat;
    act(m, chair1, "nominate", { seat: seatIndices(m).find((s) => s !== chair1)! });
    allVote(m, "nah");
    expect(pub(m).gridlock).toBe(1);
    expect(pub(m).lastVote?.passed).toBe(false);

    const chair2 = pub(m).chairSeat;
    expect(chair2).not.toBe(chair1);
    act(m, chair2, "nominate", { seat: seatIndices(m).find((s) => s !== chair2)! });
    allVote(m, "nah");
    expect(pub(m).gridlock).toBe(2);

    const enactedBefore = pub(m).merkizenEnacted + pub(m).merkiteEnacted;
    const chair3 = pub(m).chairSeat;
    act(m, chair3, "nominate", { seat: seatIndices(m).find((s) => s !== chair3)! });
    allVote(m, "nah");

    // Gridlock hit 3: anarchy resolves within this SAME vote-reveal reduce call.
    expect(pub(m).gridlock).toBe(0);
    expect(pub(m).anarchyCount).toBe(1);
    expect(pub(m).lastEnacted?.viaAnarchy).toBe(true);
    expect(pub(m).lastEnacted?.chairSeat).toBeNull();
    expect(pub(m).merkizenEnacted + pub(m).merkiteEnacted).toBe(enactedBefore + 1);
    expect(pub(m).lastChairSeat).toBeNull();
    expect(pub(m).lastCommissionerSeat).toBeNull();
    expect(m.state.phase).toBe("nominate");
    assertDeckConserved(m);
  });

  it("anarchy never triggers a power even when the chaos-enacted card lands exactly on a power threshold", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "anarchy-threshold" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    // Get exactly 1 Merkite enacted first (7-8p board: Loyalty Audit fires on the 2nd).
    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 1, { avoidNominee: boss, avoidPowerTarget: boss });
    expect(pub(m).merkiteEnacted).toBe(1);
    expect(m.state.phase).toBe("nominate");

    // Force the chaos-enact to draw a concrete Merkite card (test-only secretState access).
    const forced = secret(m);
    m.state = { ...m.state, secretState: { ...forced, topStack: ["merkite", ...forced.topStack] } };

    for (let i = 0; i < 3; i++) {
      const chair = pub(m).chairSeat;
      nominateNext(m, chair);
      allVote(m, "nah");
    }

    expect(pub(m).merkiteEnacted).toBe(2); // exactly the Loyalty Audit threshold on the 7-8p board
    expect(pub(m).lastEnacted?.viaAnarchy).toBe(true);
    expect(m.state.phase).toBe("nominate"); // never power_audit
    expect(pub(m).activePower).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Term limits                                                         */
/* ------------------------------------------------------------------ */

describe("term limits", () => {
  it("validateNominateTarget: last Commissioner always ineligible; last Chair ineligible only while living > 5", () => {
    const ctx6 = fakeCtx(6);
    const base = basePublicState({ chairSeat: 0 as SeatIndex, lastChairSeat: 2 as SeatIndex, lastCommissionerSeat: 3 as SeatIndex });

    // 6 living (> 5): last Chair IS term-limited.
    expect(validateNominateTarget(ctx6, base, 0 as SeatIndex, 2)?.code).toBe("term_limited");
    // Last Commissioner is ALWAYS term-limited, regardless of living count.
    expect(validateNominateTarget(ctx6, base, 0 as SeatIndex, 3)?.code).toBe("term_limited");
    // Anyone else is a legal target.
    expect(validateNominateTarget(ctx6, base, 0 as SeatIndex, 4)).toBeNull();

    // Banish one seat down to 5 living (<= 5): last Chair becomes eligible again.
    const at5 = basePublicState({ ...base, banishedSeats: [5 as SeatIndex] });
    expect(validateNominateTarget(ctx6, at5, 0 as SeatIndex, 2)).toBeNull();
    // ...but last Commissioner is STILL term-limited even at 5 living.
    expect(validateNominateTarget(ctx6, at5, 0 as SeatIndex, 3)?.code).toBe("term_limited");
  });

  it("validateNominateTarget: self-nomination, nonexistent seat, and banished target are all rejected", () => {
    const ctx = fakeCtx(6);
    const base = basePublicState({ chairSeat: 0 as SeatIndex, banishedSeats: [4 as SeatIndex] });
    expect(validateNominateTarget(ctx, base, 0 as SeatIndex, 0)?.code).toBe("self_nomination");
    expect(validateNominateTarget(ctx, base, 0 as SeatIndex, 4)?.code).toBe("target_banished");
    expect(validateNominateTarget(ctx, base, 0 as SeatIndex, 99)?.code).toBe("invalid_target");
    expect(validateNominateTarget(ctx, base, 0 as SeatIndex, "not-a-seat")?.code).toBe("invalid_target");
  });

  it("end-to-end: nominating the just-elected Commissioner again is rejected via the real reducer", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "term-e2e" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    const chair1 = pub(m).chairSeat;
    const nominee1 = nominateNext(m, chair1);
    allVote(m, "yeah");
    expect(pub(m).lastCommissionerSeat).toBe(nominee1);

    const wentToPower = playLegislativeSession(m, "merkizen");
    if (wentToPower) resolvePower(m);
    expect(m.state.phase).toBe("nominate");

    const chair2 = pub(m).chairSeat;
    if (chair2 === nominee1) {
      // Chair rotation naturally landed on the just-elected Commissioner — they can't
      // nominate themselves regardless of term limits; that rule takes precedence.
      expect(actErr(m, chair2, "nominate", { seat: nominee1 }).code).toBe("self_nomination");
    } else {
      expect(actErr(m, chair2, "nominate", { seat: nominee1 }).code).toBe("term_limited");
    }
  });
});

/* ------------------------------------------------------------------ */
/* Veto                                                                 */
/* ------------------------------------------------------------------ */

describe("veto", () => {
  it("propose_veto is rejected before the 5th Merkite decree unlocks it (veto_locked)", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "veto-locked" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    allVote(m, "yeah");
    act(m, pub(m).chairSeat, "discard_decree", { index: 0 });
    const commissioner = pub(m).commissionerSeat as SeatIndex;
    expect(actErr(m, commissioner, "propose_veto").code).toBe("veto_locked");
  });

  it("agree -> both cards discarded, gridlock+1, Merkite track unchanged, conservation holds", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "veto-agree" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 5, { avoidNominee: boss, avoidPowerTarget: boss });
    expect(m.over).toBe(false);
    expect(pub(m).merkiteEnacted).toBe(5);
    expect(pub(m).gridlock).toBe(0);
    const enactedBefore = pub(m).merkiteEnacted;

    const chair = pub(m).chairSeat;
    nominateNext(m, chair, { avoidSeat: boss });
    allVote(m, "yeah");
    act(m, pub(m).chairSeat, "discard_decree", { index: 0 });
    const commissioner = pub(m).commissionerSeat as SeatIndex;

    act(m, commissioner, "propose_veto");
    expect(m.state.phase).toBe("veto_pending");
    act(m, pub(m).chairSeat, "resolve_veto", { agree: true });

    expect(pub(m).gridlock).toBe(1);
    expect(pub(m).merkiteEnacted).toBe(enactedBefore); // vetoed, never enacted
    expect(m.state.phase).toBe("nominate");
    assertDeckConserved(m);
  });

  it("refuse -> forced back to legislative_commissioner; veto not proposable again this session", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "veto-refuse" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 5, { avoidNominee: boss, avoidPowerTarget: boss });
    expect(m.over).toBe(false);

    const chair = pub(m).chairSeat;
    nominateNext(m, chair, { avoidSeat: boss });
    allVote(m, "yeah");
    act(m, pub(m).chairSeat, "discard_decree", { index: 0 });
    const commissioner = pub(m).commissionerSeat as SeatIndex;

    act(m, commissioner, "propose_veto");
    act(m, pub(m).chairSeat, "resolve_veto", { agree: false });
    expect(m.state.phase).toBe("legislative_commissioner");
    expect(actErr(m, commissioner, "propose_veto").code).toBe("veto_already_resolved");

    const hand = priv(m, commissioner).hand ?? [];
    expect(hand.length).toBe(2);
    act(m, commissioner, "enact_decree", { index: 0 });
    expect(m.state.phase).not.toBe("legislative_commissioner");
  });

  it("veto's gridlock+1 stacks with later failed votes to eventually trigger MERKY ANARCHY", () => {
    // NOTE: a pass always resets gridlock to 0 first (matching the source rules), so a
    // single veto can never jump gridlock from 2 straight to 3 — veto is only ever
    // reachable via a pass. What IS reachable: veto contributes its own +1 (0 -> 1),
    // and subsequent failed votes build on that same counter (1 -> 2 -> 3 -> anarchy).
    const m = createTestMatch(merkissioner, { players: 7, seed: "veto-anarchy-chain" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 5, { avoidNominee: boss, avoidPowerTarget: boss });
    expect(m.over).toBe(false);
    expect(pub(m).gridlock).toBe(0);

    const chair = pub(m).chairSeat;
    nominateNext(m, chair, { avoidSeat: boss });
    allVote(m, "yeah");
    act(m, pub(m).chairSeat, "discard_decree", { index: 0 });
    const commissioner = pub(m).commissionerSeat as SeatIndex;
    act(m, commissioner, "propose_veto");
    act(m, pub(m).chairSeat, "resolve_veto", { agree: true });

    expect(pub(m).gridlock).toBe(1);
    expect(m.state.phase).toBe("nominate");

    for (let i = 0; i < 2; i++) {
      const c = pub(m).chairSeat;
      nominateNext(m, c, { avoidSeat: boss });
      allVote(m, "nah");
    }

    expect(pub(m).gridlock).toBe(0); // anarchy fired and reset it
    expect(pub(m).anarchyCount).toBe(1);
    expect(pub(m).lastEnacted?.viaAnarchy).toBe(true);
    // The chaos-enact draws whatever the deck gives it — since Merkite was already at 5,
    // drawing one more Merkite here legitimately ends the game (merkite_decrees). Either
    // outcome is correct; what matters is anarchy itself fired via the shared code path.
    if (m.over) {
      expect(pub(m).winReason).toBe("merkite_decrees");
    } else {
      expect(m.state.phase).toBe("nominate");
    }
  });
});

/* ------------------------------------------------------------------ */
/* Powers                                                               */
/* ------------------------------------------------------------------ */

describe("powers", () => {
  it("Loyalty Audit: result lands ONLY in the Chair's own privateState; re-auditing is rejected", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "audit-power" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    // 7-8p board: Loyalty Audit fires on the 2nd Merkite decree.
    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_audit", { avoidNominee: boss, stopBeforePower: true });
    expect(m.state.phase).toBe("power_audit");

    const chairSeat = pub(m).chairSeat;
    const target = seatIndices(m).find((s) => s !== chairSeat && !pub(m).banishedSeats.includes(s))!;
    act(m, chairSeat, "use_power", { seat: target });

    const chairPriv = priv(m, chairSeat);
    expect(chairPriv.auditResults.length).toBe(1);
    expect(chairPriv.auditResults[0]!.seat).toBe(target);
    const targetRole = priv(m, target).role;
    const expectedParty = targetRole === "merkizen" ? "merkizen" : "merkite";
    expect(chairPriv.auditResults[0]!.party).toBe(expectedParty);

    for (const s of seatIndices(m)) {
      if (s === chairSeat) continue;
      expect(priv(m, s).auditResults.length).toBe(0);
    }
    expect(pub(m).auditedSeats).toContain(target);
    assertPublicStateSafe(m);

    // Force back into power_audit (with the original auditor restored as Chair) to test
    // the already_audited rejection directly — auditing only ever fires once naturally.
    m.state = { ...m.state, phase: "power_audit", publicState: { ...pub(m), activePower: "audit", chairSeat } };
    expect(actErr(m, chairSeat, "use_power", { seat: target }).code).toBe("already_audited");
  });

  it("Docket Peek: the next legislative draw matches the peeked cards exactly, in order", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "peek-power" }); // 5-6p board: Peek fires on the 3rd
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_peek", { avoidNominee: boss, stopBeforePower: true });
    expect(m.state.phase).toBe("power_peek");

    const chairSeat = pub(m).chairSeat;
    act(m, chairSeat, "use_power", {});

    const peeked = priv(m, chairSeat).peek;
    expect(peeked).not.toBeNull();
    expect(peeked!.length).toBe(3);
    expect(pub(m).lastPeekBy).toBe(chairSeat);
    assertPublicStateSafe(m);
    expect(m.state.phase).toBe("nominate");

    const nextChair = pub(m).chairSeat;
    nominateNext(m, nextChair, { avoidSeat: boss });
    allVote(m, "yeah");
    const dealtHand = priv(m, pub(m).chairSeat).hand;
    expect(dealtHand).toEqual(peeked);
  });

  it("Snap Election: sets the next Chair to the target; rotation resumes after the ORIGINAL invoker afterward", () => {
    const m = createTestMatch(merkissioner, { players: 8, seed: "snap-power" }); // 7-8p board: Snap fires on the 3rd
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_snap", { avoidNominee: boss, stopBeforePower: true });
    expect(m.state.phase).toBe("power_snap");

    const invoker = pub(m).chairSeat;
    const anchorBeforeSnap = pub(m).rotationAnchorSeat;
    const snapTarget = seatIndices(m).find((s) => s !== invoker && !pub(m).banishedSeats.includes(s))!;
    act(m, invoker, "use_power", { seat: snapTarget });

    expect(m.state.phase).toBe("nominate");
    expect(pub(m).chairSeat).toBe(snapTarget);
    expect(pub(m).rotationAnchorSeat).toBe(anchorBeforeSnap); // anchor untouched by the snap itself

    // Whatever the snap-appointed Chair's term does, the NEXT nominate resumes normal
    // rotation from just after the ORIGINAL invoker — never from the snap appointee.
    nominateNext(m, snapTarget, { avoidSeat: boss });
    allVote(m, "nah");

    const expectedResumeChair = nextLivingSeat(fakeCtx(8), pub(m), anchorBeforeSnap);
    expect(pub(m).chairSeat).toBe(expectedResumeChair);
  });
});

/* ------------------------------------------------------------------ */
/* Reshuffle + conservation                                             */
/* ------------------------------------------------------------------ */

describe("reshuffle + conservation", () => {
  it("reshuffles the discard pile back into the draw pile once it dips below 3; the 17-card invariant holds throughout", () => {
    const m = createTestMatch(merkissioner, { players: 8, seed: "reshuffle-long" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");

    let sawReshuffle = false;
    let prevDrawCount = pub(m).drawCount;
    for (let i = 0; i < 40 && !m.over; i++) {
      playOneRound(m, i % 2 === 0 ? "merkizen" : "merkite", { avoidNominee: boss, avoidPowerTarget: boss });
      if (m.over) break;
      assertDeckConserved(m);
      if (pub(m).drawCount > prevDrawCount) sawReshuffle = true;
      prevDrawCount = pub(m).drawCount;
    }
    expect(sawReshuffle).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Rejections                                                          */
/* ------------------------------------------------------------------ */

describe("rejections", () => {
  it("ready_up: already_ready, then bad_phase once the huddle is over", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-ready" });
    const s0 = 0 as SeatIndex;
    act(m, s0, "ready_up");
    expect(actErr(m, s0, "ready_up").code).toBe("already_ready");
    for (const s of seatIndices(m)) if (s !== s0) act(m, s, "ready_up");
    expect(m.state.phase).toBe("nominate");
    expect(actErr(m, s0, "ready_up").code).toBe("bad_phase");
  });

  it("nominate: not_chair, invalid_target, and bad_phase once past the nominate phase", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-nominate" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    const notChair = seatIndices(m).find((s) => s !== chair)!;
    expect(actErr(m, notChair, "nominate", { seat: chair === 0 ? 1 : 0 }).code).toBe("not_chair");
    expect(actErr(m, chair, "nominate", {}).code).toBe("invalid_target");
    const nominee = nominateNext(m, chair);
    expect(actErr(m, chair, "nominate", { seat: nominee }).code).toBe("bad_phase");
  });

  it("cast_vote: bad_phase before the vote opens, invalid_vote for a malformed payload", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-vote" });
    const s0 = 0 as SeatIndex;
    expect(actErr(m, s0, "cast_vote", { vote: "yeah" }).code).toBe("bad_phase");
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    expect(actErr(m, s0, "cast_vote", { vote: "maybe" }).code).toBe("invalid_vote");
  });

  it("discard_decree: bad_phase, not_chair, invalid_index", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-discard" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    expect(actErr(m, chair, "discard_decree", { index: 0 }).code).toBe("bad_phase");
    nominateNext(m, chair);
    allVote(m, "yeah");
    expect(m.state.phase).toBe("legislative_chair");
    const notChair = seatIndices(m).find((s) => s !== chair)!;
    expect(actErr(m, notChair, "discard_decree", { index: 0 }).code).toBe("not_chair");
    expect(actErr(m, chair, "discard_decree", { index: 5 }).code).toBe("invalid_index");
    expect(actErr(m, chair, "discard_decree", { index: -1 }).code).toBe("invalid_index");
  });

  it("enact_decree: bad_phase, not_commissioner, invalid_index", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-enact" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    allVote(m, "yeah");
    const commissioner = pub(m).commissionerSeat as SeatIndex;
    expect(actErr(m, commissioner, "enact_decree", { index: 0 }).code).toBe("bad_phase");
    act(m, pub(m).chairSeat, "discard_decree", { index: 0 });
    expect(m.state.phase).toBe("legislative_commissioner");
    const notCommissioner = seatIndices(m).find((s) => s !== commissioner)!;
    expect(actErr(m, notCommissioner, "enact_decree", { index: 0 }).code).toBe("not_commissioner");
    expect(actErr(m, commissioner, "enact_decree", { index: 9 }).code).toBe("invalid_index");
  });

  it("resolve_veto: bad_phase when no veto is pending", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-resolve-veto" });
    expect(actErr(m, 0 as SeatIndex, "resolve_veto", { agree: true }).code).toBe("bad_phase");
  });

  it("use_power: bad_phase, not_chair, invalid_target, self_target", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-power" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    expect(actErr(m, 0 as SeatIndex, "use_power", {}).code).toBe("bad_phase");

    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_banish", { avoidNominee: boss, stopBeforePower: true });
    expect(m.state.phase).toBe("power_banish");
    const chairSeat = pub(m).chairSeat;
    const notChair = seatIndices(m).find((s) => s !== chairSeat)!;
    expect(actErr(m, notChair, "use_power", { seat: 0 }).code).toBe("not_chair");
    expect(actErr(m, chairSeat, "use_power", { seat: 99 }).code).toBe("invalid_target");
    expect(actErr(m, chairSeat, "use_power", { seat: chairSeat }).code).toBe("self_target");
  });

  it("unknown_action is rejected for any type the game doesn't recognize", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-unknown" });
    expect(actErr(m, 0 as SeatIndex, "do_a_barrel_roll").code).toBe("unknown_action");
  });

  it("acting from a banished seat is always rejected with seat_banished, for any action or phase", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "rej-banished-actor" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_banish", { avoidNominee: boss, stopBeforePower: true });
    const chairSeat = pub(m).chairSeat;
    const target = seatIndices(m).find((s) => s !== chairSeat && s !== boss)!;
    act(m, chairSeat, "use_power", { seat: target });
    expect(pub(m).banishedSeats).toContain(target);
    expect(actErr(m, target, "cast_vote", { vote: "yeah" }).code).toBe("seat_banished");
    expect(actErr(m, target, "ready_up").code).toBe("seat_banished");
  });
});

/* ------------------------------------------------------------------ */
/* Timers                                                               */
/* ------------------------------------------------------------------ */

describe("timers", () => {
  it("huddle: fireTimer auto-readies every straggler and begins the first nominate", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "timer-huddle" });
    act(m, 0 as SeatIndex, "ready_up");
    fireTimer(m);
    expect(m.state.phase).toBe("nominate");
    expect(pub(m).readySeats.length).toBe(5);
  });

  it("vote: fireTimer auto-casts every missing ballot via rng and reveals", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "timer-vote" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    fireTimer(m); // nobody voted — the timer must force everyone
    expect(pub(m).lastVote).not.toBeNull();
    expect(pub(m).lastVote!.auto).toBe(true);
    expect(pub(m).lastVote!.tally.yeah + pub(m).lastVote!.tally.nah).toBe(5);
    expect(["legislative_chair", "nominate"]).toContain(m.state.phase);
  });

  it("legislative_chair and legislative_commissioner auto-progress on fireTimer", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "timer-legislative" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    allVote(m, "yeah");
    expect(m.state.phase).toBe("legislative_chair");
    fireTimer(m);
    expect(m.state.phase).toBe("legislative_commissioner");
    fireTimer(m);
    // The very first decree ever enacted can never trigger a power on either board.
    expect(m.state.phase).toBe("nominate");
  });

  it("veto_pending auto-refuses on fireTimer", () => {
    const m = createTestMatch(merkissioner, { players: 7, seed: "timer-veto" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    driveRoundsUntil(m, "merkite", () => pub(m).merkiteEnacted >= 5, { avoidNominee: boss, avoidPowerTarget: boss });
    const chair = pub(m).chairSeat;
    nominateNext(m, chair, { avoidSeat: boss });
    allVote(m, "yeah");
    act(m, pub(m).chairSeat, "discard_decree", { index: 0 });
    const commissioner = pub(m).commissionerSeat as SeatIndex;
    act(m, commissioner, "propose_veto");
    expect(m.state.phase).toBe("veto_pending");
    fireTimer(m);
    expect(m.state.phase).toBe("legislative_commissioner");
    expect(pub(m).vetoRefusedThisSession).toBe(true);
  });

  it("power phases auto-progress on fireTimer, including Docket Peek which needs no target", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "timer-power" });
    const boss = findSeatWithRole(m, "merkissioner");
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    driveRoundsUntil(m, "merkite", () => m.state.phase === "power_peek", { avoidNominee: boss, stopBeforePower: true });
    expect(m.state.phase).toBe("power_peek");
    fireTimer(m);
    expect(m.state.phase).toBe("nominate");
  });

  it("timersEnabled: false -> timer is always null, never set", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "timer-off", settings: { timersEnabled: false } });
    expect(m.timer).toBeNull();
    act(m, 0 as SeatIndex, "ready_up");
    expect(m.timer).toBeNull();
    for (const s of seatIndices(m)) if (s !== 0) act(m, s, "ready_up");
    expect(m.state.phase).toBe("nominate");
    expect(m.timer).toBeNull();
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    expect(m.timer).toBeNull();
    allVote(m, "yeah");
    expect(m.timer).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Abandonment + bots                                                    */
/* ------------------------------------------------------------------ */

describe("abandonment + bots", () => {
  it("an abandoned Chair is covered by suggestBotAction through nominate and the legislative session", () => {
    const m = createTestMatch(merkissioner, { players: 6, seed: "bot-chair" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    abandonSeat(m, chair);

    expect(botStep(m)).toBeGreaterThan(0); // covers the nominate
    expect(m.state.phase).toBe("vote");

    for (const s of seatIndices(m)) {
      if (s === chair) continue;
      act(m, s, "cast_vote", { vote: "yeah" });
    }
    expect(m.state.phase).toBe("legislative_chair");
    expect(botStep(m)).toBeGreaterThan(0); // covers the discard
    expect(m.state.phase).toBe("legislative_commissioner");

    const commissioner = pub(m).commissionerSeat as SeatIndex;
    act(m, commissioner, "enact_decree", { index: 0 });
    if (m.state.phase.startsWith("power_")) {
      expect(botStep(m)).toBeGreaterThan(0); // the same abandoned Chair covers the power too
    }
  });

  it("an abandoned voter is excluded from the tally and never blocks vote completion", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "bot-vote" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);

    const abandoned = seatIndices(m).find((s) => s !== chair)!;
    abandonSeat(m, abandoned);

    for (const s of seatIndices(m)) {
      if (s === abandoned) continue;
      act(m, s, "cast_vote", { vote: "yeah" });
    }
    expect(pub(m).lastVote).not.toBeNull();
    expect(pub(m).lastVote!.tally.yeah + pub(m).lastVote!.tally.nah).toBe(4); // abandoned seat excluded
    expect(botStep(m)).toBe(0); // no bot vote is ever cast for an abandoned seat
  });

  it("onSeatAbandoned re-checks huddle completion so the last straggler leaving can't stall it", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "bot-huddle" });
    const seats = seatIndices(m);
    for (const s of seats.slice(0, 4)) act(m, s, "ready_up");
    expect(m.state.phase).toBe("huddle");
    abandonSeat(m, seats[4]!);
    expect(m.state.phase).toBe("nominate"); // re-checked immediately, no timer needed
  });

  it("onSeatAbandoned re-checks vote completion so the last straggler leaving can't stall it", () => {
    const m = createTestMatch(merkissioner, { players: 5, seed: "bot-vote-abandon" });
    for (const s of seatIndices(m)) act(m, s, "ready_up");
    const chair = pub(m).chairSeat;
    nominateNext(m, chair);
    const seats = seatIndices(m);
    const last = seats.find((s) => s !== chair)!;
    for (const s of seats) {
      if (s === last) continue;
      act(m, s, "cast_vote", { vote: "yeah" });
    }
    expect(m.state.phase).toBe("vote");
    abandonSeat(m, last);
    expect(m.state.phase).not.toBe("vote"); // resolved immediately, no timer needed
  });
});
