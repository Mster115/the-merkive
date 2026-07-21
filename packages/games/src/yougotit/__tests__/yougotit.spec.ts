import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  actErr,
  fireTimer,
  abandonSeat,
  botStep,
  ctxOf,
  type TestMatch,
} from "@merky/game-sdk/testing";
import type { SeatIndex } from "@merky/game-sdk";
import { yougotit } from "../index";
import {
  otherTeam,
  zonePoints,
  type TeamId,
  type YougotitPrivateState,
  type YougotitPublicState,
} from "../logic";
import { YOUGOTIT_AFTERDARK_SPECTRA, YOUGOTIT_CORE_SPECTRA, yougotitPacks, type Spectrum } from "../packs";

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

describe("init", () => {
  it("deals balanced teams for every player count 4..8, starts Treble at 1pt, and produces a valid first turn", () => {
    for (let n = 4; n <= 8; n++) {
      const m = createTestMatch(yougotit, { players: n, seed: `init-${n}` });
      const pub = m.state.publicState as YougotitPublicState;

      expect(m.state.phase).toBe("clue");
      const bassSize = pub.teams.bass.length;
      const trebleSize = pub.teams.treble.length;
      expect(bassSize + trebleSize).toBe(n);
      expect(Math.abs(bassSize - trebleSize)).toBeLessThanOrEqual(1);
      expect(bassSize).toBeGreaterThanOrEqual(trebleSize);

      expect(pub.teamScores).toEqual({ bass: 0, treble: 1 });
      expect(pub.activeTeam).toBe("bass");
      expect(pub.teams.bass).toContain(pub.oracleSeat);
      expect(pub.pointerAngle).toBe(90);
      expect(pub.turnNumber).toBe(1);

      expect(typeof pub.prompt.left).toBe("string");
      expect(typeof pub.prompt.right).toBe("string");

      const oraclePriv = m.state.privateState[pub.oracleSeat] as YougotitPrivateState;
      expect(typeof oraclePriv.targetAngle).toBe("number");
      expect(oraclePriv.targetAngle).toBeGreaterThanOrEqual(24);
      expect(oraclePriv.targetAngle).toBeLessThanOrEqual(156);
    }
  });

  it("SECURITY: targetAngle never appears in publicState during clue/guess/steal, and only the Oracle's privateState carries it", () => {
    const m = createTestMatch(yougotit, { players: 5, seed: "security-1" });
    let pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;

    const assertNoLeak = () => {
      expect(JSON.stringify(m.state.publicState)).not.toContain("targetAngle");
      for (const s of m.seats) {
        const p = m.state.privateState[s.seatIndex] as YougotitPrivateState | undefined;
        if (s.seatIndex === oracle) {
          expect(typeof p?.targetAngle).toBe("number");
        } else {
          expect(p?.targetAngle).toBeUndefined();
        }
      }
    };

    // clue
    assertNoLeak();
    act(m, oracle, "submit_clue", { text: "vibes" });

    // guess
    assertNoLeak();
    pub = m.state.publicState as YougotitPublicState;
    const guessers = pub.teams[pub.activeTeam].filter((s) => s !== oracle);
    for (const g of guessers) act(m, g, "lock_pointer");

    // steal (5p -> bass 3 / treble 2, stealEnabled defaults true)
    expect(m.state.phase).toBe("steal");
    assertNoLeak();

    fireTimer(m); // resolve steal with no votes cast -> reveal
    expect(m.state.phase).toBe("reveal");
    pub = m.state.publicState as YougotitPublicState;
    expect(typeof pub.targetAngle).toBe("number");
  });
});

/* ------------------------------------------------------------------ */
/* Clue phase                                                          */
/* ------------------------------------------------------------------ */

describe("clue phase", () => {
  it("rejects empty, whitespace-only, too-long, and non-Oracle clues; accepts a valid one", () => {
    const m = createTestMatch(yougotit, { players: 4, seed: "clue-1" });
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    const notOracle = m.seats.find((s) => s.seatIndex !== oracle)!.seatIndex as SeatIndex;

    const errNotOracle = actErr(m, notOracle, "submit_clue", { text: "nope" });
    expect(errNotOracle.code).toBe("not_oracle");

    const errEmpty = actErr(m, oracle, "submit_clue", { text: "   " });
    expect(errEmpty.code).toBe("empty_clue");

    const errTooLong = actErr(m, oracle, "submit_clue", { text: "x".repeat(61) });
    expect(errTooLong.code).toBe("too_long");

    act(m, oracle, "submit_clue", { text: "totally valid clue" });
    const after = m.state.publicState as YougotitPublicState;
    expect(m.state.phase).toBe("guess");
    expect(after.clue).toBe("totally valid clue");
    expect(after.clueWasAuto).toBe(false);
  });

  it("auto-clues from the built-in fallback list when the clue timer expires", () => {
    const m = createTestMatch(yougotit, { players: 4, seed: "clue-auto" });
    fireTimer(m);
    const pub = m.state.publicState as YougotitPublicState;
    expect(m.state.phase).toBe("guess");
    expect(pub.clueWasAuto).toBe(true);
    expect(typeof pub.clue).toBe("string");
    expect(pub.clue!.length).toBeGreaterThan(0);
  });

  it("rejects guess/steal actions while still in the clue phase, and unknown action types outright", () => {
    const m = createTestMatch(yougotit, { players: 4, seed: "clue-phase-guard" });
    expect(actErr(m, 0, "move_pointer", { angle: 90 }).code).toBe("bad_phase");
    expect(actErr(m, 0, "lock_pointer").code).toBe("bad_phase");
    expect(actErr(m, 0, "guess_direction", { dir: "left" }).code).toBe("bad_phase");
    expect(actErr(m, 0, "nonsense_action").code).toBe("unknown_action");
  });

  it("covers an abandoned Oracle's clue via suggestBotAction so the match never stalls", () => {
    const m = createTestMatch(yougotit, { players: 4, seed: "abandoned-oracle" });
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    abandonSeat(m, oracle);
    expect(m.state.phase).toBe("clue");
    expect(yougotit.awaitedSeats(ctxOf(m), m.state)).toContain(oracle);

    const applied = botStep(m);
    expect(applied).toBe(1);
    const after = m.state.publicState as YougotitPublicState;
    expect(m.state.phase).toBe("guess");
    expect(after.clueWasAuto).toBe(false); // bot used submit_clue directly, not the timeout path
  });
});

/* ------------------------------------------------------------------ */
/* Guess phase                                                         */
/* ------------------------------------------------------------------ */

describe("guess phase", () => {
  function toGuessPhase(seed: string, players = 5): TestMatch {
    const m = createTestMatch(yougotit, { players, seed });
    const pub = m.state.publicState as YougotitPublicState;
    act(m, pub.oracleSeat, "submit_clue", { text: "clue" });
    return m;
  }

  it("validates move_pointer bounds and enforces guesser-only access", () => {
    const m = toGuessPhase("guess-bounds");
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    const guesser = pub.teams[pub.activeTeam].find((s) => s !== oracle)!;
    const opponent = pub.teams[otherTeam(pub.activeTeam)][0]!;

    expect(actErr(m, oracle, "move_pointer", { angle: 100 }).code).toBe("not_guesser");
    expect(actErr(m, opponent, "move_pointer", { angle: 100 }).code).toBe("not_guesser");
    expect(actErr(m, guesser, "move_pointer", { angle: -1 }).code).toBe("invalid_angle");
    expect(actErr(m, guesser, "move_pointer", { angle: 181 }).code).toBe("invalid_angle");
    expect(actErr(m, guesser, "move_pointer", { angle: 45.5 }).code).toBe("invalid_angle");
    expect(actErr(m, guesser, "move_pointer", { angle: "90" }).code).toBe("invalid_angle");

    act(m, guesser, "move_pointer", { angle: 33 });
    expect((m.state.publicState as YougotitPublicState).pointerAngle).toBe(33);
  });

  it("locks in, still allows a change of heart after locking, and advances once every eligible guesser is ready", () => {
    const m = toGuessPhase("guess-lock", 5); // bass=3 -> oracle + 2 guessers, so the phase stays open after the first lock
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    const guessers = pub.teams[pub.activeTeam].filter((s) => s !== oracle);
    expect(guessers.length).toBe(2);

    const first = guessers[0]!;
    const second = guessers[1]!;
    act(m, first, "lock_pointer");
    expect(actErr(m, first, "lock_pointer").code).toBe("already_locked");
    expect(m.state.phase).toBe("guess"); // second guesser hasn't locked in yet

    // Still allowed to move the dial after locking in ("change of heart").
    act(m, first, "move_pointer", { angle: 77 });
    const afterMove = m.state.publicState as YougotitPublicState;
    expect(afterMove.pointerAngle).toBe(77);
    expect(afterMove.readySeats).toContain(first);

    act(m, second, "lock_pointer");
    expect(["steal", "reveal"]).toContain(m.state.phase);
  });

  it("auto-advances out of guess phase on timer expiry regardless of lock state", () => {
    const m = toGuessPhase("guess-timer", 4);
    const pub = m.state.publicState as YougotitPublicState;
    const guesser = pub.teams[pub.activeTeam].find((s) => s !== pub.oracleSeat)!;
    act(m, guesser, "move_pointer", { angle: 15 });
    fireTimer(m);
    expect(["steal", "reveal"]).toContain(m.state.phase);
  });
});

/* ------------------------------------------------------------------ */
/* Steal / the Undercut                                                */
/* ------------------------------------------------------------------ */

describe("steal / the Undercut", () => {
  function setupAtSteal(seed: string, players: number, pointerOffset: number) {
    const m = createTestMatch(yougotit, { players, seed, settings: { stealEnabled: true } });
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "clue" });

    const oraclePriv = m.state.privateState[oracle] as YougotitPrivateState;
    const target = oraclePriv.targetAngle!;
    const pointer = Math.max(0, Math.min(180, target + pointerOffset));

    const afterClue = m.state.publicState as YougotitPublicState;
    const guessers = afterClue.teams[afterClue.activeTeam].filter((s) => s !== oracle);
    expect(guessers.length).toBeGreaterThan(0);
    act(m, guessers[0]!, "move_pointer", { angle: pointer });
    for (const g of guessers) act(m, g, "lock_pointer");
    expect(m.state.phase).toBe("steal");

    return { m, target, pointer, oracle };
  }

  it("rejects votes from the Oracle, active-team members, and invalid directions", () => {
    const { m } = setupAtSteal("steal-guards", 4, 30);
    const pub = m.state.publicState as YougotitPublicState;
    expect(actErr(m, pub.oracleSeat, "guess_direction", { dir: "left" }).code).toBe("not_opponent");
    const opponent = pub.teams[otherTeam(pub.activeTeam)][0]!;
    expect(actErr(m, opponent, "guess_direction", { dir: "up" }).code).toBe("invalid_direction");
  });

  it("awards the opposing team a point on a correct majority", () => {
    const { m, target, pointer } = setupAtSteal("steal-correct", 4, 30); // target < pointer always -> "left"
    const pub = m.state.publicState as YougotitPublicState;
    const opponents = pub.teams[otherTeam(pub.activeTeam)];
    const correctDir = target < pointer ? "left" : "right";
    for (const s of opponents) act(m, s, "guess_direction", { dir: correctDir });

    const revealed = m.state.publicState as YougotitPublicState;
    expect(m.state.phase).toBe("reveal");
    expect(revealed.lastTurn!.undercut).toEqual(
      expect.objectContaining({ awarded: true, correct: correctDir, majority: correctDir, toTeam: otherTeam(revealed.lastTurn!.activeTeam) })
    );
  });

  it("awards no point on an incorrect majority", () => {
    const { m } = setupAtSteal("steal-incorrect", 4, 30); // correct is "left"
    const pub = m.state.publicState as YougotitPublicState;
    const opponents = pub.teams[otherTeam(pub.activeTeam)];
    for (const s of opponents) act(m, s, "guess_direction", { dir: "right" });

    const revealed = m.state.publicState as YougotitPublicState;
    expect(revealed.lastTurn!.undercut).toEqual(
      expect.objectContaining({ awarded: false, correct: "left", majority: "right" })
    );
  });

  it("awards no point on a tied vote", () => {
    const { m } = setupAtSteal("steal-tie", 4, 30);
    const pub = m.state.publicState as YougotitPublicState;
    const opponents = pub.teams[otherTeam(pub.activeTeam)];
    expect(opponents.length).toBe(2);
    act(m, opponents[0]!, "guess_direction", { dir: "left" });
    act(m, opponents[1]!, "guess_direction", { dir: "right" });

    const revealed = m.state.publicState as YougotitPublicState;
    expect(revealed.lastTurn!.undercut).toEqual(expect.objectContaining({ awarded: false, majority: null }));
  });

  it("awards no point when nobody votes before the steal timer fires", () => {
    const { m } = setupAtSteal("steal-novotes", 4, 30);
    fireTimer(m);
    const revealed = m.state.publicState as YougotitPublicState;
    expect(m.state.phase).toBe("reveal");
    expect(revealed.lastTurn!.undercut).toEqual(
      expect.objectContaining({ awarded: false, majority: null, votes: { left: 0, right: 0 } })
    );
  });

  it("gives no Undercut point when the pointer sits exactly on the target, regardless of votes (and it's a bullseye)", () => {
    const { m } = setupAtSteal("steal-exact", 4, 0);
    const pub = m.state.publicState as YougotitPublicState;
    const opponents = pub.teams[otherTeam(pub.activeTeam)];
    for (const s of opponents) act(m, s, "guess_direction", { dir: "left" });

    const revealed = m.state.publicState as YougotitPublicState;
    expect(revealed.lastTurn!.undercut).toEqual(expect.objectContaining({ awarded: false, correct: null }));
    expect(revealed.lastTurn!.points).toBe(4);
  });

  it("skips the Undercut phase entirely when stealEnabled is false", () => {
    const m = createTestMatch(yougotit, { players: 4, seed: "steal-disabled", settings: { stealEnabled: false } });
    const pub = m.state.publicState as YougotitPublicState;
    act(m, pub.oracleSeat, "submit_clue", { text: "clue" });
    const after = m.state.publicState as YougotitPublicState;
    const guessers = after.teams[pub.activeTeam].filter((s) => s !== pub.oracleSeat);
    for (const g of guessers) act(m, g, "lock_pointer");

    expect(m.state.phase).toBe("reveal"); // never visited "steal"
    expect((m.state.publicState as YougotitPublicState).lastTurn!.undercut).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Scoring math                                                        */
/* ------------------------------------------------------------------ */

describe("scoring zones", () => {
  it("zonePoints matches the frozen dial-math table, symmetric on both sides of target", () => {
    const cases: [number, 0 | 2 | 3 | 4][] = [
      [0, 4],
      [4.5, 4],
      [4.6, 3],
      [13.5, 3],
      [13.6, 2],
      [22.5, 2],
      [22.6, 0],
    ];
    for (const [delta, pts] of cases) {
      expect(zonePoints(delta)).toBe(pts);
      expect(zonePoints(-delta)).toBe(pts);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Catch-up rule & Oracle rotation                                     */
/* ------------------------------------------------------------------ */

describe("catch-up rule and Oracle rotation", () => {
  function playTurn(m: TestMatch, expectedActive: TeamId, scoreFourPts: boolean): SeatIndex {
    const pub = m.state.publicState as YougotitPublicState;
    expect(pub.activeTeam).toBe(expectedActive);
    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "clue" });

    const oraclePriv = m.state.privateState[oracle] as YougotitPrivateState;
    const target = oraclePriv.targetAngle!;
    const pointer = scoreFourPts ? target : 0; // pointer=0 is always >22.5away since TARGET_MIN=24

    const afterClue = m.state.publicState as YougotitPublicState;
    const guessers = afterClue.teams[expectedActive].filter((s) => s !== oracle);
    act(m, guessers[0]!, "move_pointer", { angle: pointer });
    for (const g of guessers) act(m, g, "lock_pointer");

    expect(m.state.phase).toBe("reveal");
    fireTimer(m);
    return oracle;
  }

  it("same team rides again with the next oracle in rotation after a 4pt catch-up bullseye", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "catchup-1",
      settings: { stealEnabled: false, targetScore: "999" },
    });

    playTurn(m, "bass", false); // Bass misses -> bass=0, treble=1
    expect((m.state.publicState as YougotitPublicState).teamScores).toEqual({ bass: 0, treble: 1 });

    playTurn(m, "treble", true); // Treble bullseyes -> treble=5, now leading (no catch-up)
    let pub = m.state.publicState as YougotitPublicState;
    expect(pub.teamScores).toEqual({ bass: 0, treble: 5 });
    expect(pub.activeTeam).toBe("bass"); // alternated normally

    const turn3Oracle = playTurn(m, "bass", true); // Bass bullseyes -> bass=4, STILL trailing treble's 5 -> catch-up!
    pub = m.state.publicState as YougotitPublicState;
    expect(pub.teamScores).toEqual({ bass: 4, treble: 5 });
    expect(pub.activeTeam).toBe("bass"); // catch-up: same team goes again
    expect(pub.oracleSeat).not.toBe(turn3Oracle); // rotated to the next Bass oracle
  });

  it("skips abandoned seats when picking a new Oracle", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "oracle-skip-abandoned",
      settings: { stealEnabled: false, targetScore: "999" },
    });
    let pub = m.state.publicState as YougotitPublicState;
    expect(pub.teams.bass.length).toBe(2);
    const currentOracle = pub.oracleSeat;
    const otherBass = pub.teams.bass.find((s) => s !== currentOracle)!;

    abandonSeat(m, otherBass); // the ONLY other Bass member — not the mandatory current Oracle

    function missTurn(team: TeamId) {
      const p = m.state.publicState as YougotitPublicState;
      expect(p.activeTeam).toBe(team);
      act(m, p.oracleSeat, "submit_clue", { text: "clue" });
      const after = m.state.publicState as YougotitPublicState;
      const guessers = after.teams[team].filter((s) => s !== p.oracleSeat && s !== otherBass);
      for (const g of guessers) act(m, g, "move_pointer", { angle: 0 });
      for (const g of guessers) act(m, g, "lock_pointer");
      expect(m.state.phase).toBe("reveal");
      fireTimer(m);
    }

    missTurn("bass"); // Bass's only eligible member is the mandatory oracle -> 0 eligible guessers -> auto-resolves
    pub = m.state.publicState as YougotitPublicState;
    expect(pub.activeTeam).toBe("treble");

    missTurn("treble");
    pub = m.state.publicState as YougotitPublicState;
    expect(pub.activeTeam).toBe("bass");
    expect(pub.oracleSeat).toBe(currentOracle); // still the only non-abandoned Bass member
  });
});

/* ------------------------------------------------------------------ */
/* Winning                                                             */
/* ------------------------------------------------------------------ */

describe("winning", () => {
  it("ends the match once a team reaches targetScore with a clear lead", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "win-1",
      settings: { targetScore: "4", stealEnabled: false },
    });
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "clue" });
    const oraclePriv = m.state.privateState[oracle] as YougotitPrivateState;
    const target = oraclePriv.targetAngle!;
    const after = m.state.publicState as YougotitPublicState;
    const guessers = after.teams[pub.activeTeam].filter((s) => s !== oracle);
    act(m, guessers[0]!, "move_pointer", { angle: target });
    for (const g of guessers) act(m, g, "lock_pointer");

    expect(m.state.phase).toBe("reveal");
    fireTimer(m);
    expect(m.state.phase).toBe("game_over");
    expect(m.over).toBe(true);
    const finalPub = m.state.publicState as YougotitPublicState;
    expect(finalPub.winnerTeam).toBe("bass");
  });

  it("continues in sudden death when a scored point plus a successful Undercut ties both teams at/above targetScore", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "sudden-death-1",
      settings: { targetScore: "2", stealEnabled: true },
    });
    const pub = m.state.publicState as YougotitPublicState;
    expect(pub.teamScores).toEqual({ bass: 0, treble: 1 });

    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "clue" });
    const oraclePriv = m.state.privateState[oracle] as YougotitPrivateState;
    const target = oraclePriv.targetAngle!;
    const pointer = Math.max(0, Math.min(180, target + 18)); // exactly a 2pt zone hit, target < pointer always

    const after = m.state.publicState as YougotitPublicState;
    const guessers = after.teams.bass.filter((s) => s !== oracle);
    act(m, guessers[0]!, "move_pointer", { angle: pointer });
    for (const g of guessers) act(m, g, "lock_pointer");
    expect(m.state.phase).toBe("steal");

    const opponents = (m.state.publicState as YougotitPublicState).teams.treble;
    for (const o of opponents) act(m, o, "guess_direction", { dir: "left" }); // correct -> +1 to treble

    const revealed = m.state.publicState as YougotitPublicState;
    expect(m.state.phase).toBe("reveal");
    expect(revealed.lastTurn!.points).toBe(2);
    expect(revealed.lastTurn!.undercut!.awarded).toBe(true);
    expect(revealed.teamScores).toEqual({ bass: 2, treble: 2 });

    fireTimer(m); // reached targetScore but tied -> sudden death continues
    expect(m.state.phase).not.toBe("game_over");
    expect(m.over).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Golden path                                                         */
/* ------------------------------------------------------------------ */

describe("golden path", () => {
  it("plays a fully scripted match through clue -> guess -> reveal -> game_over with correct final scores", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "golden-path-scripted",
      settings: { targetScore: "4", stealEnabled: false },
    });
    expect(m.state.phase).toBe("clue");
    expect((m.state.publicState as YougotitPublicState).teamScores).toEqual({ bass: 0, treble: 1 });

    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "warm" });
    const oraclePriv = m.state.privateState[oracle] as YougotitPrivateState;
    const target = oraclePriv.targetAngle!;
    const afterClue = m.state.publicState as YougotitPublicState;
    const guessers = afterClue.teams.bass.filter((s) => s !== oracle);
    act(m, guessers[0]!, "move_pointer", { angle: target });
    for (const g of guessers) act(m, g, "lock_pointer");

    expect(m.state.phase).toBe("reveal");
    const revealedPub = m.state.publicState as YougotitPublicState;
    expect(revealedPub.lastTurn).toEqual(
      expect.objectContaining({ points: 4, activeTeam: "bass", targetAngle: target })
    );

    fireTimer(m); // bass reaches targetScore(4) with a clear lead over treble's 1 -> game_over
    expect(m.state.phase).toBe("game_over");
    expect(m.over).toBe(true);

    const finalPub = m.state.publicState as YougotitPublicState;
    expect(finalPub.winnerTeam).toBe("bass");
    expect(finalPub.teamScores).toEqual({ bass: 4, treble: 1 });
    for (const s of finalPub.teams.bass) expect(m.scores[s]).toBe(4);
    for (const s of finalPub.teams.treble) expect(m.scores[s]).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Abandonment & bot coverage                                          */
/* ------------------------------------------------------------------ */

describe("abandonment and bot coverage", () => {
  it("keeps a fully-abandoned match moving to game_over via bot/timer coverage, with scores always mirroring team totals", () => {
    const m = createTestMatch(yougotit, {
      players: 5,
      seed: "bot-loop-1",
      settings: { targetScore: "4" },
    });
    for (const s of m.seats) abandonSeat(m, s.seatIndex);

    let maxSteps = 3000;
    while (!m.over && maxSteps > 0) {
      maxSteps--;
      const applied = botStep(m);
      if (applied === 0 && !m.over) fireTimer(m);
    }

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");

    const pub = m.state.publicState as YougotitPublicState;
    for (const s of pub.teams.bass) expect(m.scores[s]).toBe(pub.teamScores.bass);
    for (const s of pub.teams.treble) expect(m.scores[s]).toBe(pub.teamScores.treble);
  });

  it("re-checks guess completion when the only guesser abandons mid-guess, auto-advancing the phase", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "abandon-mid-guess",
      settings: { stealEnabled: false },
    });
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "clue" });
    const after = m.state.publicState as YougotitPublicState;
    const guessers = after.teams[pub.activeTeam].filter((s) => s !== oracle);
    expect(guessers.length).toBe(1);

    abandonSeat(m, guessers[0]!);
    expect(m.state.phase).toBe("reveal");
  });

  it("re-checks the Undercut vote when the last un-voted opponent abandons mid-steal", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "abandon-mid-steal",
      settings: { stealEnabled: true },
    });
    const pub = m.state.publicState as YougotitPublicState;
    const oracle = pub.oracleSeat;
    act(m, oracle, "submit_clue", { text: "clue" });
    const after = m.state.publicState as YougotitPublicState;
    const guessers = after.teams[pub.activeTeam].filter((s) => s !== oracle);
    for (const g of guessers) act(m, g, "lock_pointer");
    expect(m.state.phase).toBe("steal");

    const opponents = (m.state.publicState as YougotitPublicState).teams[otherTeam(pub.activeTeam)];
    expect(opponents.length).toBe(2);
    act(m, opponents[0]!, "guess_direction", { dir: "left" });
    abandonSeat(m, opponents[1]!);

    expect(m.state.phase).toBe("reveal");
  });
});

/* ------------------------------------------------------------------ */
/* Determinism                                                         */
/* ------------------------------------------------------------------ */

describe("determinism", () => {
  it("produces an identical transcript for the same seed", () => {
    const settings = { targetScore: "4" };

    function drive(m: TestMatch) {
      let steps = 500;
      while (!m.over && steps > 0) {
        steps--;
        const pub = m.state.publicState as YougotitPublicState;
        if (m.state.phase === "clue") {
          act(m, pub.oracleSeat, "submit_clue", { text: "same every time" });
        } else if (m.state.phase === "guess") {
          const guessers = pub.teams[pub.activeTeam].filter((s) => s !== pub.oracleSeat);
          for (const g of guessers) act(m, g, "lock_pointer");
        } else if (m.state.phase === "steal") {
          const opponents = pub.teams[otherTeam(pub.activeTeam)];
          for (const o of opponents) act(m, o, "guess_direction", { dir: "left" });
        } else if (m.state.phase === "reveal") {
          fireTimer(m);
        }
      }
    }

    const m1 = createTestMatch(yougotit, { players: 5, seed: "determinism-1", settings });
    const m2 = createTestMatch(yougotit, { players: 5, seed: "determinism-1", settings });
    drive(m1);
    drive(m2);

    expect(m1.over).toBe(true);
    expect(m2.over).toBe(true);
    expect(m1.state.phase).toBe(m2.state.phase);
    expect(m1.state.publicState).toEqual(m2.state.publicState);
    expect(m1.scores).toEqual(m2.scores);
    expect(m1.log).toEqual(m2.log);
  });
});

/* ------------------------------------------------------------------ */
/* Prompt pool cycling                                                 */
/* ------------------------------------------------------------------ */

describe("prompt pool", () => {
  it("does not repeat a prompt until the whole pool has been used once", () => {
    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "prompt-cycle",
      settings: { stealEnabled: false, targetScore: "999" },
    });
    const poolSize = YOUGOTIT_CORE_SPECTRA.length;
    const seen: Spectrum[] = [];

    for (let i = 0; i < poolSize; i++) {
      const pub = m.state.publicState as YougotitPublicState;
      seen.push(pub.prompt);
      act(m, pub.oracleSeat, "submit_clue", { text: "clue" });
      const afterClue = m.state.publicState as YougotitPublicState;
      const guessers = afterClue.teams[pub.activeTeam].filter((s) => s !== pub.oracleSeat);
      for (const g of guessers) act(m, g, "lock_pointer");
      expect(m.state.phase).toBe("reveal");
      fireTimer(m); // -> next clue phase (targetScore 999 is unreachable within this loop)
    }

    const uniqueKeys = new Set(seen.map((p) => `${p.left}|||${p.right}`));
    expect(uniqueKeys.size).toBe(poolSize);

    const nextPrompt = (m.state.publicState as YougotitPublicState).prompt;
    expect(uniqueKeys.has(`${nextPrompt.left}|||${nextPrompt.right}`)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Content packs                                                       */
/* ------------------------------------------------------------------ */

describe("content packs", () => {
  it("draws prompts from the After Dark pack when it is resolved onto ctx.settings._pack", () => {
    const afterdarkPack = yougotitPacks.find((p) => p.id === "yougotit-afterdark");
    expect(afterdarkPack).toBeDefined();

    const m = createTestMatch(yougotit, {
      players: 4,
      seed: "afterdark-pack",
      settings: { packId: "yougotit-afterdark", _pack: afterdarkPack },
    });
    const pub = m.state.publicState as YougotitPublicState;
    const afterdarkKeys = new Set(YOUGOTIT_AFTERDARK_SPECTRA.map((p) => `${p.left}|||${p.right}`));
    expect(afterdarkKeys.has(`${pub.prompt.left}|||${pub.prompt.right}`)).toBe(true);
  });
});
