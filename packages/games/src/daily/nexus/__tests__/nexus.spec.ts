import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { nexus } from "../index";
import { getDailyGame } from "../../index";
import { validatePack, normalizeAnswer } from "../utils";
import type { DailyContentPack } from "../../types";
import type { NexusPublicState, NexusPayload } from "../types";

const samplePayload: NexusPayload = {
  rowLabels: ["Geography", "Science", "History"],
  colLabels: ["Capitals", "Nobels", "Islands"],
  cells: [
    {
      row: 0,
      col: 0,
      question: "Capital of France?",
      answer: "The City of Paris",
      acceptableAnswers: ["Paris"],
    },
    {
      row: 0,
      col: 1,
      question: "Capital of Sweden home to Nobel committee?",
      answer: "Stockholm",
      acceptableAnswers: [],
    },
    {
      row: 0,
      col: 2,
      question: "Island capital of Japan?",
      answer: "Tokyo",
      acceptableAnswers: [],
    },
    {
      row: 1,
      col: 0,
      question: "Capital known for London physics lab?",
      answer: "London",
      acceptableAnswers: ["The City of London"],
    },
    {
      row: 1,
      col: 1,
      question: "Physicist born in Ulm who won Nobel?",
      answer: "Albert Einstein",
      acceptableAnswers: ["Einstein"],
    },
    {
      row: 1,
      col: 2,
      question: "Island laboratory site where Curie researched?",
      answer: "Paris",
      acceptableAnswers: [],
    },
    {
      row: 2,
      col: 0,
      question: "Historic ancient capital of Italy?",
      answer: "Rome",
      acceptableAnswers: ["The City of Rome"],
    },
    {
      row: 2,
      col: 1,
      question: "Peace prize laureate activist born in Atlanta?",
      answer: "Martin Luther King Jr.",
      acceptableAnswers: ["MLK", "MLK Jr"],
    },
    {
      row: 2,
      col: 2,
      question: "Island site of ancient Trojan War city?",
      answer: "Crete",
      acceptableAnswers: [],
    },
  ],
};

const samplePack: DailyContentPack = {
  gameId: "nexus",
  puzzleDate: "2026-07-24",
  sourceRefs: [
    { url: "https://example.com/ref", title: "Merkive Reference Archive" },
  ],
  payload: samplePayload,
};

describe("nexus daily game module", () => {
  it("is registered in the daily game registry", () => {
    expect(getDailyGame("nexus")).toBe(nexus);
  });

  it("validatePack accepts the pipeline's submission envelope, not just a bare payload", () => {
    // service.submitPack calls validatePack({ gameId, puzzleDate, payload,
    // sourceRefs }). Reading fields off the envelope's top level rejects every
    // real submission while a bare-payload spec still passes, so assert the
    // shape the pipeline actually sends.
    const enveloped = nexus.validatePack(
      {
        gameId: "nexus",
        puzzleDate: "2026-07-24",
        payload: samplePayload,
        sourceRefs: samplePack.sourceRefs,
      },
      "2026-07-24"
    );
    expect(enveloped.ok).toBe(true);
    if (enveloped.ok) {
      expect(enveloped.pack.gameId).toBe("nexus");
      expect(enveloped.pack.sourceRefs).toEqual(samplePack.sourceRefs);
    }
  });

  it("normalization helper lowercases, trims, collapses spaces, and strips leading articles", () => {
    expect(normalizeAnswer("The Great Wall of China")).toBe("great wall of china");
    expect(normalizeAnswer("a banana")).toBe("banana");
    expect(normalizeAnswer("an  apple")).toBe("apple");
    expect(normalizeAnswer("   The   City   of   London   ")).toBe("city of london");
    expect(normalizeAnswer("the")).toBe("the");
    expect(normalizeAnswer("another")).toBe("another");
  });

  it("validatePack validates structure and rejects invalid packs", () => {
    const validRes = validatePack(samplePack, "2026-07-24");
    expect(validRes.ok).toBe(true);

    // Empty sourceRefs
    const noRefsPack = JSON.parse(JSON.stringify(samplePack));
    noRefsPack.sourceRefs = [];
    expect(validatePack(noRefsPack, "2026-07-24").ok).toBe(false);

    // Missing cell
    const incompletePack = JSON.parse(JSON.stringify(samplePack));
    incompletePack.payload.cells.pop();
    expect(validatePack(incompletePack, "2026-07-24").ok).toBe(false);

    // Empty question
    const emptyQPack = JSON.parse(JSON.stringify(samplePack));
    emptyQPack.payload.cells[0].question = "  ";
    expect(validatePack(emptyQPack, "2026-07-24").ok).toBe(false);
  });

  it("init produces all 9 cells unanswered with no answer text in publicState", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const pub = run.state.publicState as NexusPublicState;
    expect(pub.cells.length).toBe(9);
    expect(pub.score).toBe(0);
    for (const cell of pub.cells) {
      expect(cell.status).toBe("unanswered");
      expect(cell.answer).toBeUndefined();
    }
  });

  it("handles correct, incorrect, and alternate-answer matching with normalization", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    // Test alternate answer with article stripping ("a paris" -> "paris", matching acceptableAnswers)
    act(run, "answer_cell", { row: 0, col: 0, guess: "a paris" });
    let pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[0]?.status).toBe("correct");
    expect(pub.score).toBe(1);

    // Test incorrect answer
    act(run, "answer_cell", { row: 0, col: 1, guess: "Wrong Answer" });
    pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[1]?.status).toBe("incorrect");
    expect(pub.score).toBe(1);

    // Test canonical answer with article stripping ("The City of London" -> "city of london")
    act(run, "answer_cell", { row: 1, col: 0, guess: "London" });
    pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[3]?.status).toBe("correct");
    expect(pub.score).toBe(2);
  });

  it("a locked cell rejects a second guess", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });

    // Second guess on locked cell must be rejected
    const err = actErr(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(err.code).toBe("cell_locked");
  });

  it("reveal_cell fills answer text but does not count toward score", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    act(run, "reveal_cell", { row: 0, col: 0 });
    const pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[0]?.status).toBe("revealed");
    expect(pub.cells[0]?.answer).toBe("The City of Paris");
    expect(pub.score).toBe(0);
  });

  it("submit before all 9 resolved fails with code incomplete", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const err = actErr(run, "submit");
    expect(err.code).toBe("incomplete");
  });

  it("full-correct run reaches solved and score 9", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const answers = [
      "Paris",
      "Stockholm",
      "Tokyo",
      "London",
      "Einstein",
      "Paris",
      "Rome",
      "MLK",
      "Crete",
    ];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        act(run, "answer_cell", {
          row: r,
          col: c,
          guess: answers[r * 3 + c],
        });
      }
    }

    const pubBefore = run.state.publicState as NexusPublicState;
    expect(pubBefore.score).toBe(9);

    act(run, "submit");
    expect(run.phase).toBe("solved");
    expect(run.over).toBe(true);

    const summary = nexus.summarize(ctxOf(run), run.state);
    expect(summary.status).toBe("solved");
    expect(summary.stats.completed).toBe(true);
    expect(summary.stats.score).toBe(9);
  });

  it("a run with any incorrect/revealed cell reaches failed", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    // 8 correct, 1 revealed
    const answers = [
      "Paris",
      "Stockholm",
      "Tokyo",
      "London",
      "Einstein",
      "Paris",
      "Rome",
      "MLK",
    ];

    for (let i = 0; i < 8; i++) {
      const r = Math.floor(i / 3);
      const c = i % 3;
      act(run, "answer_cell", { row: r, col: c, guess: answers[i] });
    }

    // Reveal 9th cell
    act(run, "reveal_cell", { row: 2, col: 2 });

    act(run, "submit");
    expect(run.phase).toBe("failed");
    expect(run.over).toBe(true);

    const summary = nexus.summarize(ctxOf(run), run.state);
    expect(summary.status).toBe("failed");
    expect(summary.stats.score).toBe(8);
  });

  it("summarize().shareText never contains question or answer text for any status", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    act(run, "reveal_cell", { row: 0, col: 1 });

    const summary = nexus.summarize(ctxOf(run), run.state);
    const text = summary.shareText;

    expect(text).toContain("Nexus — 2026-07-24");
    expect(text).toContain("1/9");

    // Must not contain questions or answers
    for (const cell of samplePayload.cells) {
      expect(text.toLowerCase()).not.toContain(cell.question.toLowerCase());
      expect(text.toLowerCase()).not.toContain(cell.answer.toLowerCase());
    }
  });
});
