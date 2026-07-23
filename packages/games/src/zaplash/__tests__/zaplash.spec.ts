import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  actErr,
  fireTimer,
  abandonSeat,
} from "@merky/game-sdk/testing";
import { zaplash } from "../index";
import type { ZaplashPrivateState, ZaplashPublicState, ZaplashSecret } from "../logic";
import { ZAPLASH_SAFETY_QUIPS } from "../packs";

describe("Zaplash Game Plugin", () => {
  it("initializes match and assigns exactly 2 distinct prompts per player with 2 distinct writers per prompt", () => {
    const m = createTestMatch(zaplash, { players: 4, seed: "zaplash-seed-1" });
    const pub = m.state.publicState as ZaplashPublicState;

    expect(m.state.phase).toBe("write");
    expect(pub.round).toBe(1);
    expect(pub.submittedSeats).toHaveLength(0);

    for (let s = 0; s < 4; s++) {
      const priv = m.state.privateState[s as 0 | 1 | 2 | 3] as ZaplashPrivateState;
      expect(priv.prompts).toHaveLength(2);
      expect(priv.prompts[0]?.index).not.toBe(priv.prompts[1]?.index);
    }

    const secret = m.state.secretState as ZaplashSecret;
    const assignments = secret.roundPrompts;
    expect(assignments).toHaveLength(4);
    for (const pa of assignments) {
      expect(pa.writers[0]).not.toBe(pa.writers[1]);
    }
  });

  it("handles submit validation rejections (bad phase, bad prompt, already submitted, empty, too long)", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-seed-2" });
    const priv0 = m.state.privateState[0] as ZaplashPrivateState;
    const assignedPromptIndex = priv0.prompts[0]!.index;

    // Bad prompt index (not assigned to seat 0)
    const unassignedIndex = [0, 1, 2].find((i) => !priv0.prompts.some((p) => p.index === i))!;
    actErr(m, 0, "submit_answer", { promptIndex: unassignedIndex, text: "hello" });

    // Empty text
    actErr(m, 0, "submit_answer", { promptIndex: assignedPromptIndex, text: "   " });

    // Too long text (>120 chars)
    actErr(m, 0, "submit_answer", { promptIndex: assignedPromptIndex, text: "a".repeat(121) });

    // Valid submit
    act(m, 0, "submit_answer", { promptIndex: assignedPromptIndex, text: "Valid answer" });

    // Already submitted
    actErr(m, 0, "submit_answer", { promptIndex: assignedPromptIndex, text: "Another answer" });
  });

  it("enforces vote eligibility rejections (writer can't vote, double vote, bad phase)", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-seed-3" });

    // All players submit answers to advance to vote phase
    for (let s = 0; s < 3; s++) {
      const priv = m.state.privateState[s as 0 | 1 | 2] as ZaplashPrivateState;
      for (const p of priv.prompts) {
        act(m, s as 0 | 1 | 2, "submit_answer", { promptIndex: p.index, text: `Answer from ${s}` });
      }
    }

    expect(m.state.phase).toBe("vote");
    const pub = m.state.publicState as ZaplashPublicState;
    const matchup = pub.currentMatchup!;
    const [w0, w1] = matchup.excludedSeats;

    // Writer tries to vote on their own matchup
    actErr(m, w0!, "vote", { answerIndex: 0 });
    actErr(m, w1!, "vote", { answerIndex: 1 });

    // Non-writer votes successfully
    const eligibleVoter = ([0, 1, 2] as const).find((s) => s !== w0 && s !== w1)!;
    act(m, eligibleVoter, "vote", { answerIndex: 0 });

    // Double vote rejected
    actErr(m, eligibleVoter, "vote", { answerIndex: 1 });
  });

  it("calculates scoring math including ZAP! bonus (≥2 votes) and no bonus under 2 votes", () => {
    const m = createTestMatch(zaplash, {
      players: 4,
      seed: "zaplash-seed-score",
      settings: { zapBonus: true },
    });

    // Submit answers for all 4 players
    for (let s = 0; s < 4; s++) {
      const priv = m.state.privateState[s as 0 | 1 | 2 | 3] as ZaplashPrivateState;
      for (const p of priv.prompts) {
        act(m, s as 0 | 1 | 2 | 3, "submit_answer", { promptIndex: p.index, text: `Ans S${s} P${p.index}` });
      }
    }

    expect(m.state.phase).toBe("vote");
    const pub = m.state.publicState as ZaplashPublicState;
    const matchup = pub.currentMatchup!;
    const excluded = matchup.excludedSeats;
    const eligibleVoters = ([0, 1, 2, 3] as const).filter((s) => !excluded.includes(s));

    // Both eligible voters vote for answer index 0 (clean sweep of 2 votes -> ZAP bonus!)
    for (const v of eligibleVoters) {
      act(m, v, "vote", { answerIndex: 0 });
    }

    expect(m.state.phase).toBe("reveal");
    const pubReveal = m.state.publicState as ZaplashPublicState;
    const revealMatchup = pubReveal.currentMatchup!;

    const ans0Writer = revealMatchup.answers[0]!.writerSeat!;
    expect(revealMatchup.votesPerAnswer).toEqual([2, 0]);
    expect(revealMatchup.pointsAwarded).toEqual([250, 0]); // 2*100 + 50 zap
    expect(revealMatchup.zapSeat).toBe(ans0Writer);
    expect(m.scores[ans0Writer]).toBe(250);
  });

  it("handles missing answers with '…' on timer expiry and runs full 3-player and 4-player match to game_over", () => {
    // 3-player match where Seat 0 submits, but Seats 1 and 2 miss deadline
    const m3 = createTestMatch(zaplash, {
      players: 3,
      seed: "zaplash-3p",
      settings: { rounds: 1, writeSeconds: 30, voteSeconds: 15 },
    });

    const priv0 = m3.state.privateState[0] as ZaplashPrivateState;
    for (const p of priv0.prompts) {
      act(m3, 0, "submit_answer", { promptIndex: p.index, text: "Seat 0 answer" });
    }

    // Let timer expire in write phase -> missing answers become "…"
    fireTimer(m3);
    expect(m3.state.phase).toBe("vote");

    const pub3 = m3.state.publicState as ZaplashPublicState;
    expect(pub3.currentMatchup?.answers.some((a) => a.text === "…")).toBe(true);

    // Step through vote, reveal, scoreboard to game_over
    while (!m3.over) {
      fireTimer(m3);
    }

    expect(m3.over).toBe(true);
    expect(m3.state.phase).toBe("game_over");

    // 4-player full match
    const m4 = createTestMatch(zaplash, {
      players: 4,
      seed: "zaplash-4p",
      settings: { rounds: 2 },
    });

    let guard4 = 0;
    while (!m4.over && guard4++ < 60) {
      if (m4.state.phase === "write") {
        // Half submit, half time out
        const p0 = m4.state.privateState[0] as ZaplashPrivateState;
        for (const p of p0.prompts) {
          act(m4, 0, "submit_answer", { promptIndex: p.index, text: "Seat 0 answer" });
        }
      }
      fireTimer(m4);
    }

    expect(m4.over).toBe(true);
    expect(m4.state.phase).toBe("game_over");
  });

  it("advances phase when an awaited writer is abandoned and remaining writers finish", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-abandon" });

    // Submit for seat 0 and seat 1
    const priv0 = m.state.privateState[0] as ZaplashPrivateState;
    for (const p of priv0.prompts) {
      act(m, 0, "submit_answer", { promptIndex: p.index, text: "P0 text" });
    }
    const priv1 = m.state.privateState[1] as ZaplashPrivateState;
    for (const p of priv1.prompts) {
      act(m, 1, "submit_answer", { promptIndex: p.index, text: "P1 text" });
    }

    expect(m.state.phase).toBe("write");

    // Abandon seat 2 (who hasn't submitted) -> phase should auto-advance to vote!
    abandonSeat(m, 2);
    expect(m.state.phase).toBe("vote");
  });

  it("guarantees determinism (same seed → identical prompts) and pack fallback when _pack missing", () => {
    const m1 = createTestMatch(zaplash, { players: 3, seed: "zaplash-same-seed" });
    const m2 = createTestMatch(zaplash, { players: 3, seed: "zaplash-same-seed" });

    const secret1 = m1.state.secretState as ZaplashSecret;
    const secret2 = m2.state.secretState as ZaplashSecret;

    expect(secret1.roundPrompts.map((p) => p.promptText)).toEqual(
      secret2.roundPrompts.map((p) => p.promptText)
    );
  });
});

describe("Zaplash cumulative scoring (regression)", () => {
  it("keeps earlier points when a later matchup gets zero votes, across all matchups and rounds", () => {
    const m = createTestMatch(zaplash, {
      players: 3,
      seed: "zaplash-cumulative-1",
      settings: { rounds: 2, zapBonus: false },
    });

    const submitAll = () => {
      for (let s = 0 as 0 | 1 | 2; s < 3; s++) {
        const priv = m.state.privateState[s] as ZaplashPrivateState;
        for (const p of priv.prompts) {
          act(m, s, "submit_answer", { promptIndex: p.index, text: `ans ${s}-${p.index}` });
        }
      }
    };

    // Round 1: matchup 0 gets a real vote, the rest time out with zero votes.
    submitAll();
    expect(m.state.phase).toBe("vote");
    let pub = m.state.publicState as ZaplashPublicState;
    const firstMatchup = pub.currentMatchup!;
    const excluded = firstMatchup.excludedSeats;
    const voter = ([0, 1, 2] as const).find((s) => !excluded.includes(s))!;
    act(m, voter, "vote", { answerIndex: 0 });

    // A single vote completes the only eligible voter in a 3p/2-writer matchup,
    // triggering an immediate reveal — the true author of answers[0] is only
    // knowable now, from the revealed matchup, not from the pre-vote public state.
    const revealed = (m.state.publicState as ZaplashPublicState).currentMatchup!;
    const scoredSeat = revealed.answers[0]!.writerSeat!;
    expect(m.scores[scoredSeat]).toBe(100);

    // Burn through the rest of round 1 with timer expiries (zero-vote matchups).
    let guard = 0;
    while (m.state.phase !== "write" && m.state.phase !== "game_over" && guard++ < 30) {
      fireTimer(m);
    }
    expect(m.scores[scoredSeat]).toBe(100); // zero-vote matchups must not wipe totals

    // Round 2: submit and let everything time out.
    expect(m.state.phase).toBe("write");
    pub = m.state.publicState as ZaplashPublicState;
    expect(pub.round).toBe(2);
    submitAll();
    guard = 0;
    while (m.state.phase !== "game_over" && guard++ < 30) {
      fireTimer(m);
    }

    expect(m.state.phase).toBe("game_over");
    expect(m.over).toBe(true);
    expect(m.scores[scoredSeat]).toBe(100); // survives round carry + final emission
  });
});

describe("Zaplash Jinx rule", () => {
  it("jinxes a matchup when both writers submit the same text (case/whitespace-insensitive) — 0 points, straight to reveal", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-jinx-1" });

    // Matchup 0 (promptIndex 0) is always writers [seat0, seat1] — give them identical text.
    act(m, 0, "submit_answer", { promptIndex: 0, text: "A rubber chicken" });
    act(m, 1, "submit_answer", { promptIndex: 0, text: "  A RUBBER CHICKEN  " });
    // The other two matchups get distinct text so they can't accidentally jinx too.
    act(m, 1, "submit_answer", { promptIndex: 1, text: "seat1 unique for p1" });
    act(m, 2, "submit_answer", { promptIndex: 1, text: "seat2 unique for p1" });
    act(m, 2, "submit_answer", { promptIndex: 2, text: "seat2 unique for p2" });
    act(m, 0, "submit_answer", { promptIndex: 2, text: "seat0 unique for p2" });

    // Matchup 0 is built first, so the jinx should fire immediately — no vote phase for it.
    expect(m.state.phase).toBe("reveal");
    const pub = m.state.publicState as ZaplashPublicState;
    const matchup = pub.currentMatchup!;
    expect(matchup.jinx).toBe(true);
    expect(matchup.votesPerAnswer).toEqual([0, 0]);
    expect(matchup.pointsAwarded).toEqual([0, 0]);
    expect(matchup.zapSeat ?? null).toBeNull();
    expect(m.scores[0] ?? 0).toBe(0);
    expect(m.scores[1] ?? 0).toBe(0);

    // Timer advances past the jinxed matchup normally, into the next (non-jinxed) matchup's vote.
    fireTimer(m);
    expect(["vote", "scoreboard"]).toContain(m.state.phase);
  });
});

describe("Zaplash Safety Quip", () => {
  it("fills a regular-round prompt with a random backup answer and enforces the same submit rules", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-safety-1" });
    const priv0 = m.state.privateState[0] as ZaplashPrivateState;
    const promptIndex = priv0.prompts[0]!.index;
    const unassignedIndex = [0, 1, 2].find((i) => !priv0.prompts.some((p) => p.index === i))!;

    actErr(m, 0, "use_safety_quip", { promptIndex: unassignedIndex });

    act(m, 0, "use_safety_quip", { promptIndex });
    const privAfter = m.state.privateState[0] as ZaplashPrivateState;
    expect(ZAPLASH_SAFETY_QUIPS).toContain(privAfter.answers[promptIndex]);

    actErr(m, 0, "use_safety_quip", { promptIndex });
    actErr(m, 0, "submit_answer", { promptIndex, text: "too late now" });
  });

  it("fills a finale answer with a random backup answer and enforces the same submit rules", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-finale-safety", settings: { rounds: 1 } });
    let guard = 0;
    while (m.state.phase !== "finale_write" && guard++ < 20) {
      fireTimer(m);
    }
    expect(m.state.phase).toBe("finale_write");

    act(m, 0, "use_finale_safety_quip", {});
    const priv0 = m.state.privateState[0] as ZaplashPrivateState;
    expect(ZAPLASH_SAFETY_QUIPS).toContain(priv0.finaleAnswer);

    actErr(m, 0, "use_finale_safety_quip", {});
  });
});

describe("Zaplash Lightning Round finale", () => {
  it("runs a full finale: shared prompt, N-way vote, medal bonuses stack on cumulative totals", () => {
    const m = createTestMatch(zaplash, {
      players: 3,
      seed: "zaplash-finale-1",
      settings: { rounds: 1, writeSeconds: 30, voteSeconds: 15 },
    });

    for (let s = 0 as 0 | 1 | 2; s < 3; s++) {
      const priv = m.state.privateState[s] as ZaplashPrivateState;
      for (const p of priv.prompts) {
        act(m, s, "submit_answer", { promptIndex: p.index, text: `r1 ans ${s}-${p.index}` });
      }
    }

    let guard = 0;
    while (m.state.phase !== "finale_write" && guard++ < 20) {
      fireTimer(m);
    }
    expect(m.state.phase).toBe("finale_write");
    const pub = m.state.publicState as ZaplashPublicState;
    expect(pub.finale?.promptText).toBeTruthy();

    act(m, 0, "submit_finale_answer", { text: "Seat 0's masterpiece" });
    act(m, 1, "submit_finale_answer", { text: "Seat 1's masterpiece" });
    act(m, 2, "submit_finale_answer", { text: "Seat 2's masterpiece" });

    expect(m.state.phase).toBe("finale_vote");
    const pubVote = m.state.publicState as ZaplashPublicState;
    expect(pubVote.finale?.answers).toHaveLength(3);

    // Seats 1 and 2 both vote for seat 0 (clean sweep of the 2 votes it can receive);
    // seat 0 votes for seat 1 so every active seat has voted.
    act(m, 1, "finale_vote", { targetSeat: 0 });
    act(m, 2, "finale_vote", { targetSeat: 0 });
    act(m, 0, "finale_vote", { targetSeat: 1 });

    expect(m.state.phase).toBe("finale_reveal");
    const pubReveal = m.state.publicState as ZaplashPublicState;
    const results = pubReveal.finale!.results!;
    const seat0Result = results.find((r) => r.seat === 0)!;
    expect(seat0Result.votes).toBe(2);
    expect(seat0Result.rank).toBe(0);
    expect(seat0Result.points).toBe(2 * 100 + 500); // votes*100 + gold medal bonus
    expect(m.scores[0]).toBe(seat0Result.points);

    fireTimer(m);
    expect(m.state.phase).toBe("game_over");
    expect(m.over).toBe(true);
  });

  it("enforces finale vote validation: self-vote, invalid target, and double-vote are all rejected", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-finale-vote-validation", settings: { rounds: 1 } });
    let guard = 0;
    while (m.state.phase !== "finale_write" && guard++ < 20) {
      fireTimer(m);
    }

    act(m, 0, "submit_finale_answer", { text: "Answer zero" });
    act(m, 1, "submit_finale_answer", { text: "Answer one" });
    act(m, 2, "submit_finale_answer", { text: "Answer two" });
    expect(m.state.phase).toBe("finale_vote");

    actErr(m, 0, "finale_vote", { targetSeat: 0 }); // can't vote for yourself
    actErr(m, 0, "finale_vote", { targetSeat: 7 }); // no such answer
    act(m, 0, "finale_vote", { targetSeat: 1 });
    actErr(m, 0, "finale_vote", { targetSeat: 2 }); // already voted
  });

  it("skips voting when fewer than 2 players write a real finale answer — no medals, straight to results", () => {
    const m = createTestMatch(zaplash, { players: 3, seed: "zaplash-finale-skip", settings: { rounds: 1 } });
    let guard = 0;
    while (m.state.phase !== "finale_write" && guard++ < 20) {
      fireTimer(m);
    }
    expect(m.state.phase).toBe("finale_write");

    act(m, 0, "submit_finale_answer", { text: "The lone answer" });
    // Seats 1 and 2 time out without answering.
    fireTimer(m);

    expect(m.state.phase).toBe("finale_reveal");
    const pub = m.state.publicState as ZaplashPublicState;
    expect(pub.finale?.results).toHaveLength(1);
    expect(pub.finale?.results?.[0]).toMatchObject({ seat: 0, votes: 0, points: 0 });
    expect(m.scores[0] ?? 0).toBe(0); // no medal bonus when voting never happened

    fireTimer(m);
    expect(m.state.phase).toBe("game_over");
  });

  it("skips the Lightning Round entirely when lightningRound is disabled", () => {
    const m = createTestMatch(zaplash, {
      players: 3,
      seed: "zaplash-no-finale",
      settings: { rounds: 1, lightningRound: false },
    });
    let guard = 0;
    while (m.state.phase !== "game_over" && guard++ < 20) {
      fireTimer(m);
    }
    expect(m.state.phase).toBe("game_over");
    expect(m.over).toBe(true);
    const pub = m.state.publicState as ZaplashPublicState;
    expect(pub.finale).toBeNull();
  });
});
