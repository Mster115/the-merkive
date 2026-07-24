import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { relay } from "../index";
import { getDailyGame } from "../../index";
import type { RelayPublicState } from "../types";

const samplePackRaw = {
  startWord: "CAT",
  endWord: "DOG",
  wordBank: ["TIGER", "RABBIT", "TOAD", "DOG", "ELEPHANT"],
  sourceRefs: [{ url: "https://example.com", title: "Test Pack" }],
};

describe("relay daily game", () => {
  it("is registered in the daily game registry", () => {
    expect(getDailyGame("relay")).toBe(relay);
  });

  it("validatePack accepts the pipeline's submission envelope, not just a bare payload", () => {
    // service.submitPack calls validatePack({ gameId, puzzleDate, payload,
    // sourceRefs }). Reading fields off the envelope's top level rejects every
    // real submission while a bare-payload spec still passes, so assert the
    // shape the pipeline actually sends.
    const { sourceRefs, ...payload } = samplePackRaw;
    const enveloped = relay.validatePack(
      { gameId: "relay", puzzleDate: "2026-07-24", payload, sourceRefs },
      "2026-07-24"
    );
    expect(enveloped.ok).toBe(true);
    if (enveloped.ok) {
      expect(enveloped.pack.gameId).toBe("relay");
      expect(enveloped.pack.sourceRefs).toEqual(sourceRefs);
    }
  });

  it("validatePack accepts a valid pack and rejects an unsolvable pack", () => {
    const valid = relay.validatePack(samplePackRaw, "2026-07-24");
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.pack.gameId).toBe("relay");
      expect(valid.pack.sourceRefs).toEqual(samplePackRaw.sourceRefs);
      expect((valid.pack.payload as any).parMoves).toBe(4);
    }

    const invalidRaw = {
      startWord: "CAT",
      endWord: "DOG",
      wordBank: ["APPLE", "BANANA"],
    };
    const invalid = relay.validatePack(invalidRaw, "2026-07-24");
    expect(invalid.ok).toBe(false);
  });

  it("init seeds chain with just startWord", () => {
    const validated = relay.validatePack(samplePackRaw, "2026-07-24");
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const run = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });

    const pub = run.state.publicState as RelayPublicState;
    expect(pub.startWord).toBe("CAT");
    expect(pub.endWord).toBe("DOG");
    expect(pub.chain).toEqual(["CAT"]);
    expect(pub.usedWords).toEqual([]);
    expect(pub.movesUsed).toBe(0);
    expect(run.phase).toBe("in_progress");
  });

  it("add_word validation checks non-bank word, used word, and non-linking word", () => {
    const validated = relay.validatePack(samplePackRaw, "2026-07-24");
    if (!validated.ok) return;
    const run = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });

    // Non-bank word
    const err1 = actErr(run, "add_word", { word: "NOTINBANK" });
    expect(err1.code).toBe("invalid_word");

    // Non-linking word (starts with 'E', but chain ends with 'T')
    const err2 = actErr(run, "add_word", { word: "ELEPHANT" });
    expect(err2.code).toBe("invalid_word");

    // Add valid word TIGER (ends in 'R')
    act(run, "add_word", { word: "TIGER" });
    const pub = run.state.publicState as RelayPublicState;
    expect(pub.chain).toEqual(["CAT", "TIGER"]);
    expect(pub.usedWords).toEqual(["TIGER"]);
    expect(pub.movesUsed).toBe(1);

    // Already-used word
    const err3 = actErr(run, "add_word", { word: "TIGER" });
    expect(err3.code).toBe("invalid_word");
  });

  it("remove_last un-uses a word and rejects when chain only has startWord", () => {
    const validated = relay.validatePack(samplePackRaw, "2026-07-24");
    if (!validated.ok) return;
    const run = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });

    // Try remove on startWord only
    const errStart = actErr(run, "remove_last");
    expect(errStart.code).toBe("invalid_remove");

    // Add TIGER
    act(run, "add_word", { word: "TIGER" });
    let pub = run.state.publicState as RelayPublicState;
    expect(pub.chain).toEqual(["CAT", "TIGER"]);
    expect(pub.usedWords).toEqual(["TIGER"]);

    // Remove TIGER
    act(run, "remove_last");
    pub = run.state.publicState as RelayPublicState;
    expect(pub.chain).toEqual(["CAT"]);
    expect(pub.usedWords).toEqual([]);
    expect(pub.movesUsed).toBe(1); // Lifetime counter, does not decrement
  });

  it("full correct path reaches solved via submit", () => {
    const validated = relay.validatePack(samplePackRaw, "2026-07-24");
    if (!validated.ok) return;
    const run = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });

    // Incomplete submit fails
    const errIncomplete = actErr(run, "submit");
    expect(errIncomplete.code).toBe("incomplete");

    // Add path: TIGER -> RABBIT -> TOAD -> DOG
    act(run, "add_word", { word: "TIGER" });
    act(run, "add_word", { word: "RABBIT" });
    act(run, "add_word", { word: "TOAD" });
    act(run, "add_word", { word: "DOG" });

    // Submit succeeded
    act(run, "submit");
    expect(run.phase).toBe("solved");
    expect(run.over).toBe(true);
  });

  it("post-completion guard: rejects mutating actions and leaves submit/give_up idempotent", () => {
    const validated = relay.validatePack(samplePackRaw, "2026-07-24");
    if (!validated.ok) return;

    // Test after give_up
    const runFailed = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });
    act(runFailed, "give_up");
    expect(runFailed.phase).toBe("failed");

    // Mutating action rejected with attempt_over
    const errAdd = actErr(runFailed, "add_word", { word: "TIGER" });
    expect(errAdd.code).toBe("attempt_over");

    const errRemove = actErr(runFailed, "remove_last");
    expect(errRemove.code).toBe("attempt_over");

    // submit and give_up are idempotent no-ops
    const resSub = act(runFailed, "submit");
    expect(resSub.phase).toBe("failed");

    const resGive = act(runFailed, "give_up");
    expect(resGive.phase).toBe("failed");

    // Test after solved
    const runSolved = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });
    act(runSolved, "add_word", { word: "TIGER" });
    act(runSolved, "add_word", { word: "RABBIT" });
    act(runSolved, "add_word", { word: "TOAD" });
    act(runSolved, "add_word", { word: "DOG" });
    act(runSolved, "submit");
    expect(runSolved.phase).toBe("solved");

    const errAddSolved = actErr(runSolved, "add_word", { word: "ELEPHANT" });
    expect(errAddSolved.code).toBe("attempt_over");

    const resSubSolved = act(runSolved, "submit");
    expect(resSubSolved.phase).toBe("solved");
  });

  it("summarize().shareText never contains any bank word, startWord, or endWord", () => {
    const validated = relay.validatePack(samplePackRaw, "2026-07-24");
    if (!validated.ok) return;
    const run = createDailyTestRun(relay, {
      puzzleDate: "2026-07-24",
      pack: validated.pack,
    });

    act(run, "add_word", { word: "TIGER" });
    act(run, "add_word", { word: "RABBIT" });
    act(run, "add_word", { word: "TOAD" });
    act(run, "add_word", { word: "DOG" });
    act(run, "submit");

    const summary = relay.summarize(ctxOf(run), run.state);
    expect(summary.status).toBe("solved");
    expect(summary.stats.completed).toBe(true);

    const shareText = summary.shareText;
    const forbiddenWords = ["CAT", "DOG", "TIGER", "RABBIT", "TOAD", "ELEPHANT"];
    for (const word of forbiddenWords) {
      expect(shareText.toUpperCase()).not.toContain(word);
    }
  });
});
