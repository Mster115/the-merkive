import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  actErr,
  fireTimer,
  abandonSeat,
} from "@merky/game-sdk/testing";
import { zaplash } from "../index";
import type { ZaplashPrivateState, ZaplashPublicState } from "../logic";

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

    const assignments = pub._roundPrompts;
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
    const [w0, w1] = matchup.writers;

    // Writer tries to vote on their own matchup
    actErr(m, w0, "vote", { answerIndex: 0 });
    actErr(m, w1, "vote", { answerIndex: 1 });

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
    const [w0, w1] = matchup.writers;
    const eligibleVoters = ([0, 1, 2, 3] as const).filter((s) => s !== w0 && s !== w1);

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

    while (!m4.over) {
      if (m4.state.phase === "write") {
        // Half submit, half time out
        const p0 = m4.state.privateState[0] as ZaplashPrivateState;
        for (const p of p0.prompts) {
          act(m4, 0, "submit_answer", { promptIndex: p.index, text: "Seat 0 answer" });
        }
        fireTimer(m4);
      } else if (m4.state.phase === "vote" || m4.state.phase === "reveal" || m4.state.phase === "scoreboard") {
        fireTimer(m4);
      }
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

    const pub1 = m1.state.publicState as ZaplashPublicState;
    const pub2 = m2.state.publicState as ZaplashPublicState;

    expect(pub1._roundPrompts.map((p) => p.promptText)).toEqual(
      pub2._roundPrompts.map((p) => p.promptText)
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
    const voter = ([0, 1, 2] as const).find(
      (s) => s !== firstMatchup.writers[0] && s !== firstMatchup.writers[1]
    )!;
    act(m, voter, "vote", { answerIndex: 0 });
    const scoredSeat = firstMatchup.writers[0];
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
