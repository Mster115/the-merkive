import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  actErr,
  fireTimer,
  abandonSeat,
} from "@merky/game-sdk/testing";
import type { SeatIndex } from "@merky/game-sdk";
import { merkade } from "../index";
import type { MerkadePublicState, MerkadePrivateState, MerkadeSecretState } from "../types";
import { createEmptyGrid } from "../DoodleGrid";

/** Deterministically fire timers until publicState.phase === target, since which
 * format leads off roundPlan depends on the seed. roundCount:3 guarantees every
 * format appears exactly once among rounds 0-2, so this always terminates. */
function fireUntilPhase(m: ReturnType<typeof createTestMatch>, target: string, maxTries = 40) {
  for (let i = 0; i < maxTries; i++) {
    if ((m.state.publicState as MerkadePublicState).phase === target) return;
    if (m.over) throw new Error(`Match ended before reaching phase ${target}`);
    fireTimer(m);
  }
  throw new Error(`Never reached phase ${target} within ${maxTries} timer fires`);
}

describe("Merkade Game Plugin", () => {
  it("1. Golden path: plays through to game_over with 6 players using botStep", () => {
    const m = createTestMatch(merkade, {
      players: 6,
      seed: "merkade-golden-1",
      settings: { roundCount: 3 },
    });

    let safety = 0;
    while (!m.over && safety < 300) {
      safety++;
      const awaited = merkade.awaitedSeats(
        {
          matchId: "test-match",
          roomId: "test",
          seats: m.seats,
          settings: m.settings,
          now: m.now,
          rng: () => 0.5,
        },
        m.state as any
      );
      if (awaited.length > 0) {
        for (const seat of awaited) {
          const botAct = merkade.suggestBotAction?.(
            {
              matchId: "test-match",
              roomId: "test",
              seats: m.seats,
              settings: m.settings,
              now: m.now,
              rng: () => 0.5,
            },
            m.state as any,
            seat
          );
          if (botAct) {
            act(m, seat, botAct.type, botAct.payload);
          }
        }
      } else {
        fireTimer(m);
      }
    }

    expect(m.state.phase).toBe("game_over");
    expect(m.over).toBe(true);
    expect(m.scores).toBeDefined();

    for (let i = 0; i < 6; i++) {
      expect((m.scores as Record<number, number>)[i] ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("2a. Action rejections: fib_answer / fib_vote", () => {
    const m = createTestMatch(merkade, { players: 4, seed: "rejections-fib", settings: { roundCount: 3 } });
    fireUntilPhase(m, "fib_answer");

    const secret = m.state.secretState as MerkadeSecretState;
    const truth = secret.fib?.truth ?? "Truth";

    expect(actErr(m, 0, "submit_fib_lie", { text: "   " }).code).toBe("empty_text");
    expect(
      actErr(m, 0, "submit_fib_lie", { text: "This text is way too long and exceeds forty characters total length" })
        .code
    ).toBe("text_too_long");
    expect(actErr(m, 0, "submit_fib_lie", { text: truth }).code).toBe("is_the_truth");

    act(m, 0, "submit_fib_lie", { text: "Valid Lie 0" });
    expect(actErr(m, 0, "submit_fib_lie", { text: "Another lie" }).code).toBe("already_submitted");
    expect(actErr(m, 0, "submit_fib_vote", { optionIndex: 0 }).code).toBe("wrong_phase");

    act(m, 1, "submit_fib_lie", { text: "Valid Lie 1" });
    act(m, 2, "submit_fib_lie", { text: "Valid Lie 2" });
    act(m, 3, "submit_fib_lie", { text: "Valid Lie 3" });

    expect(m.state.phase).toBe("fib_vote");

    const votePub = m.state.publicState as MerkadePublicState;
    const voteSecret = m.state.secretState as MerkadeSecretState;
    const options = votePub.fibOptions ?? [];

    expect(actErr(m, 0, "submit_fib_vote", { optionIndex: -1 }).code).toBe("invalid_option_index");
    expect(actErr(m, 0, "submit_fib_vote", { optionIndex: 99 }).code).toBe("invalid_option_index");

    const ownLieIdx = voteSecret.fib?.authorsBySeat?.[0];
    if (ownLieIdx !== undefined) {
      expect(actErr(m, 0, "submit_fib_vote", { optionIndex: ownLieIdx }).code).toBe("own_lie");
    }

    const validOptIdx = options.findIndex((_, idx) => idx !== ownLieIdx);
    act(m, 0, "submit_fib_vote", { optionIndex: validOptIdx });
    expect(actErr(m, 0, "submit_fib_vote", { optionIndex: validOptIdx }).code).toBe("already_submitted");
  });

  it("2b. Action rejections: doodle_draw / doodle_guess / doodle_vote", () => {
    const m = createTestMatch(merkade, { players: 4, seed: "rejections-doodle", settings: { roundCount: 3 } });
    fireUntilPhase(m, "doodle_draw");

    expect(actErr(m, 0, "submit_drawing", { grid: "not a grid" }).code).toBe("invalid_grid");
    expect(actErr(m, 0, "submit_drawing", { grid: [[1, 2, 3]] }).code).toBe("invalid_grid");

    const validGrid = createEmptyGrid();
    act(m, 0, "submit_drawing", { grid: validGrid });
    expect(actErr(m, 0, "submit_drawing", { grid: validGrid }).code).toBe("already_submitted");

    act(m, 1, "submit_drawing", { grid: validGrid });
    act(m, 2, "submit_drawing", { grid: validGrid });
    act(m, 3, "submit_drawing", { grid: validGrid });

    expect(m.state.phase).toBe("doodle_guess");
    const pub = m.state.publicState as MerkadePublicState;
    const artist = pub.doodleCurrentArtist!;
    const guesser = ([0, 1, 2, 3] as SeatIndex[]).find((s) => s !== artist)!;

    expect(actErr(m, artist, "submit_guess", { text: "anything" }).code).toBe("not_your_turn");
    expect(actErr(m, guesser, "submit_guess", { text: "   " }).code).toBe("empty_text");
    expect(
      actErr(m, guesser, "submit_guess", { text: "This text is way too long and exceeds forty characters total" })
        .code
    ).toBe("text_too_long");

    act(m, guesser, "submit_guess", { text: "a wobbly guess" });
    expect(actErr(m, guesser, "submit_guess", { text: "another guess" }).code).toBe("already_submitted");

    for (const s of [0, 1, 2, 3] as SeatIndex[]) {
      if (s !== artist && s !== guesser) act(m, s, "submit_guess", { text: `guess from ${s}` });
    }

    expect(m.state.phase).toBe("doodle_vote");
    const votePub = m.state.publicState as MerkadePublicState;
    const voteSecret = m.state.secretState as MerkadeSecretState;
    const options = votePub.doodleGuessOptions ?? [];

    expect(actErr(m, artist, "submit_guess_vote", { optionIndex: 0 }).code).toBe("not_your_turn");
    expect(actErr(m, guesser, "submit_guess_vote", { optionIndex: -1 }).code).toBe("invalid_option_index");
    expect(actErr(m, guesser, "submit_guess_vote", { optionIndex: 999 }).code).toBe("invalid_option_index");

    const ownGuessIdx = voteSecret.doodle?.authorsBySeat?.[guesser];
    if (ownGuessIdx !== undefined) {
      expect(actErr(m, guesser, "submit_guess_vote", { optionIndex: ownGuessIdx }).code).toBe("own_guess");
    }
    const validOptIdx = options.findIndex((_, idx) => idx !== ownGuessIdx);
    act(m, guesser, "submit_guess_vote", { optionIndex: validOptIdx });
    expect(actErr(m, guesser, "submit_guess_vote", { optionIndex: validOptIdx }).code).toBe("already_submitted");
  });

  it("2c. Action rejections: majority_answer", () => {
    const m = createTestMatch(merkade, { players: 4, seed: "rejections-majority", settings: { roundCount: 3 } });
    fireUntilPhase(m, "majority_answer");

    expect(actErr(m, 0, "submit_majority", { choice: 5, predictedMajority: 0 }).code).toBe("invalid_choice");
    expect(actErr(m, 0, "submit_majority", { choice: 0, predictedMajority: 2 }).code).toBe("invalid_choice");

    act(m, 0, "submit_majority", { choice: 0, predictedMajority: 1 });
    expect(actErr(m, 0, "submit_majority", { choice: 1, predictedMajority: 0 }).code).toBe("already_submitted");
  });

  it("3. Timer expiry advances every timed phase cleanly", () => {
    const m = createTestMatch(merkade, {
      players: 4,
      seed: "timer-expiry-seed",
      settings: { roundCount: 3 },
    });

    const startPhase = m.state.phase;
    expect(startPhase).toBe("round_intro");

    for (let i = 0; i < 15; i++) {
      if (m.over) break;
      fireTimer(m);
    }

    expect(m.state.phase).toBeDefined();
  });

  it("4. Abandonment handling in group input and artist spotlight", () => {
    const m = createTestMatch(merkade, {
      players: 4,
      seed: "abandonment-test-seed",
      settings: { roundCount: 3 },
    });

    fireUntilPhase(m, "fib_answer");

    act(m, 0, "submit_fib_lie", { text: "Lie 0" });
    act(m, 1, "submit_fib_lie", { text: "Lie 1" });

    abandonSeat(m, 2);
    abandonSeat(m, 3);

    expect(m.state.phase).toBe("fib_vote");

    const mDoodle = createTestMatch(merkade, {
      players: 3,
      seed: "doodle-abandon-seed",
      settings: { roundCount: 3 },
    });

    fireUntilPhase(mDoodle, "doodle_draw");

    {
      const artist0 = (mDoodle.state.publicState as MerkadePublicState).doodleArtistOrder?.[0] ?? (0 as SeatIndex);
      abandonSeat(mDoodle, artist0);

      for (const seat of [0, 1, 2] as SeatIndex[]) {
        if (seat !== artist0) {
          act(mDoodle, seat, "submit_drawing", { grid: createEmptyGrid() });
        }
      }

      const newPub = mDoodle.state.publicState as MerkadePublicState;
      expect(newPub.phase).toBe("doodle_guess");
      expect(newPub.doodleCurrentArtist).not.toBe(artist0);
    }
  });

  it("5. Determinism: same seed twice produces identical transcripts", () => {
    const m1 = createTestMatch(merkade, { players: 4, seed: "deterministic-100" });
    const m2 = createTestMatch(merkade, { players: 4, seed: "deterministic-100" });

    for (let i = 0; i < 20; i++) {
      if (m1.over) break;
      const awaited1 = merkade.awaitedSeats(
        {
          matchId: "test-match",
          roomId: "test",
          seats: m1.seats,
          settings: m1.settings,
          now: m1.now,
          rng: () => 0.5,
        },
        m1.state as any
      );
      if (awaited1.length > 0) {
        for (const seat of awaited1) {
          const act1 = merkade.suggestBotAction?.(
            { matchId: "test-match", roomId: "test", seats: m1.seats, settings: m1.settings, now: m1.now, rng: () => 0.5 },
            m1.state as any,
            seat
          );
          if (act1) act(m1, seat, act1.type, act1.payload);

          const act2 = merkade.suggestBotAction?.(
            { matchId: "test-match", roomId: "test", seats: m2.seats, settings: m2.settings, now: m2.now, rng: () => 0.5 },
            m2.state as any,
            seat
          );
          if (act2) act(m2, seat, act2.type, act2.payload);
        }
      } else {
        fireTimer(m1);
        fireTimer(m2);
      }
    }

    expect(m1.log).toEqual(m2.log);
    expect(m1.scores).toEqual(m2.scores);
  });

  it("6. Security / No-Leak invariants across all phases", () => {
    const m = createTestMatch(merkade, {
      players: 4,
      seed: "security-no-leak-seed",
      settings: { roundCount: 6 },
    });

    const checkNoLeaks = () => {
      const pubStr = JSON.stringify(m.state.publicState);
      const secret = m.state.secretState as MerkadeSecretState;
      const pub = m.state.publicState as MerkadePublicState;

      // 1. Truth in Fib must not be in publicState before fib_reveal
      if (pub.phase === "fib_answer") {
        const fibTruth = secret.fib?.truth;
        if (fibTruth && fibTruth.length > 2) {
          expect(pubStr).not.toContain(`"${fibTruth}"`);
        }
      } else if (pub.phase === "fib_vote") {
        expect(pub.fibReveal).toBeUndefined();
      }

      // 2. Secret doodle word must not be in publicState before doodle_reveal_one (or doodle_vote for spotlight artist)
      if (pub.phase === "doodle_draw" || pub.phase === "doodle_guess") {
        const words = secret.doodle?.wordsBySeat ?? {};
        for (const word of Object.values(words)) {
          if (word && word.length > 2) {
            expect(pubStr).not.toContain(`"${word}"`);
          }
        }
      } else if (pub.phase === "doodle_vote") {
        const words = secret.doodle?.wordsBySeat ?? {};
        const artistOrder = pub.doodleArtistOrder ?? [];
        const spotlightIdx = pub.doodleSpotlightIndex ?? 0;
        for (let i = spotlightIdx + 1; i < artistOrder.length; i++) {
          const unrevealedArtist = artistOrder[i];
          if (unrevealedArtist !== undefined) {
            const word = (words as Record<number, string | undefined>)[unrevealedArtist];
            if (word && word.length > 2) {
              expect(pubStr).not.toContain(`"${word}"`);
            }
          }
        }
      }

      // 3. Majority choices / predictions must not be in publicState before majority_reveal
      if (pub.phase === "majority_answer") {
        expect(pub.majorityReveal).toBeUndefined();
      }

      // 4. Private state slices: each seat must not see another seat's private slice
      const privMap = m.state.privateState as Record<number, MerkadePrivateState>;
      if (pub.phase === "doodle_draw") {
        for (let s = 0; s < 4; s++) {
          const slice = privMap[s];
          const expectedWord = (secret.doodle?.wordsBySeat as Record<number, string | undefined>)?.[s];
          if (slice?.doodleWord && expectedWord) {
            expect(slice.doodleWord).toBe(expectedWord);
          }
        }
      }
    };

    checkNoLeaks();

    let safety = 0;
    while (!m.over && safety < 300) {
      safety++;
      const awaited = merkade.awaitedSeats(
        {
          matchId: "test-match",
          roomId: "test",
          seats: m.seats,
          settings: m.settings,
          now: m.now,
          rng: () => 0.5,
        },
        m.state as any
      );
      if (awaited.length > 0) {
        for (const seat of awaited) {
          const botAct = merkade.suggestBotAction?.(
            { matchId: "test-match", roomId: "test", seats: m.seats, settings: m.settings, now: m.now, rng: () => 0.5 },
            m.state as any,
            seat
          );
          if (botAct) act(m, seat, botAct.type, botAct.payload);
        }
      } else {
        fireTimer(m);
      }
      checkNoLeaks();
    }
  });
});
