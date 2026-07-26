import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { nexus } from "../index";
import { getDailyGame } from "../../index";
import { validatePack, normalizeAnswer, wordsToNumber, isOneEditAway } from "../utils";
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

  it("wordsToNumber parses digits and spelled-out numbers, and rejects ordinary text", () => {
    expect(wordsToNumber("8")).toBe(8);
    expect(wordsToNumber("eight")).toBe(8);
    expect(wordsToNumber("Eight")).toBe(8);
    expect(wordsToNumber("zero")).toBe(0);
    expect(wordsToNumber("twenty-one")).toBe(21);
    expect(wordsToNumber("twenty one")).toBe(21);
    expect(wordsToNumber("one hundred")).toBe(100);
    expect(wordsToNumber("one hundred and one")).toBe(101);
    expect(wordsToNumber("1,969")).toBe(1969);
    expect(wordsToNumber("paris")).toBeNull();
    expect(wordsToNumber("")).toBeNull();
    expect(wordsToNumber("eight ball")).toBeNull();
  });

  it("isOneEditAway flags a single insertion, deletion, substitution, or adjacent transposition", () => {
    expect(isOneEditAway("einstein", "einstien")).toBe(true); // adjacent transposition
    expect(isOneEditAway("einstein", "einsteinn")).toBe(true); // one extra letter
    expect(isOneEditAway("einstein", "einsten")).toBe(true); // one missing letter
    expect(isOneEditAway("einstein", "einstain")).toBe(true); // one substitution
    // Still a valid 1-edit result on its own — the MIN_LENGTH_FOR_FUZZY_MATCH
    // guard in index.ts is what keeps this from being treated as "close" for
    // real, since a short word one edit away is often just a different word.
    expect(isOneEditAway("rome", "dome")).toBe(true);
  });

  it("isOneEditAway rejects an exact match (that's just correct) and anything further than 1 edit", () => {
    expect(isOneEditAway("einstein", "einstein")).toBe(false);
    expect(isOneEditAway("einstein", "epstein")).toBe(false); // two non-adjacent-fixable diffs
    expect(isOneEditAway("einstein", "newton")).toBe(false);
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

    // A wrong answer no longer closes the cell — it stays open, worth less.
    act(run, "answer_cell", { row: 0, col: 1, guess: "Wrong Answer" });
    pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[1]?.status).toBe("unanswered");
    expect(pub.cells[1]?.attempts).toBe(1);
    expect(pub.score).toBe(1);

    // Test canonical answer with article stripping ("The City of London" -> "city of london")
    act(run, "answer_cell", { row: 1, col: 0, guess: "London" });
    pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[3]?.status).toBe("correct");
    expect(pub.score).toBe(2);
  });

  it("flags a 1-edit typo as 'close' instead of spending the attempt on it", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    // Cell (1,1): answer "Albert Einstein", acceptable "Einstein" — 8 letters,
    // clears the fuzzy-match length guard.
    const err = actErr(run, "answer_cell", { row: 1, col: 1, guess: "Einstien" });
    expect(err.code).toBe("close_spelling");

    let pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[4]?.status).toBe("unanswered");
    expect(pub.cells[4]?.attempts ?? 0).toBe(0); // rejected outright — no attempt spent
    expect(pub.score).toBe(0);

    // Fixing the spelling still lands on the first-try value.
    act(run, "answer_cell", { row: 1, col: 1, guess: "Einstein" });
    pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[4]?.status).toBe("correct");
    expect(pub.score).toBe(1);
  });

  it("does not extend 'close' leniency to short answers, even 1 edit away", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    // Cell (2,0): canonical "Rome" is only 4 letters — under the fuzzy-match
    // guard — so a 1-edit guess is judged as a plain wrong answer, not "close".
    act(run, "answer_cell", { row: 2, col: 0, guess: "Dome" });
    const pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[6]?.status).toBe("unanswered");
    expect(pub.cells[6]?.attempts).toBe(1);
    expect(pub.score).toBe(0);
  });

  it("treats a spelled-out number and its digit form as the same answer", () => {
    const numPack = JSON.parse(JSON.stringify(samplePack));
    // Cell (2,2) canonical -> digit form; cell (2,0) canonical -> word form.
    numPack.payload.cells[8].answer = "8";
    numPack.payload.cells[8].acceptableAnswers = [];
    numPack.payload.cells[6].answer = "eight";
    numPack.payload.cells[6].acceptableAnswers = [];

    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: numPack,
    });

    act(run, "answer_cell", { row: 2, col: 2, guess: "eight" });
    let pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[8]?.status).toBe("correct");

    act(run, "answer_cell", { row: 2, col: 0, guess: "8" });
    pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[6]?.status).toBe("correct");
    expect(pub.score).toBe(2);
  });

  it("an empty guess is rejected and leaves the cell still answerable", () => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const err = actErr(run, "answer_cell", { row: 0, col: 0, guess: "   " });
    expect(err.code).toBe("empty_guess");

    // The cell must not have been consumed — one guess per cell means a stray
    // empty submit would otherwise be unrecoverable.
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    const pub = run.state.publicState as NexusPublicState;
    expect(pub.cells[0]!.status).toBe("correct");
    expect(pub.score).toBe(1);
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

describe("nexus decaying points", () => {
  const runFresh = () =>
    createDailyTestRun(nexus, { puzzleDate: "2026-07-24", pack: samplePack });

  const pubOf = (run: ReturnType<typeof runFresh>) =>
    run.state.publicState as NexusPublicState;

  it("pays a full point on the first try", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(pubOf(run).score).toBe(1);
    expect(pubOf(run).cells[0]?.points).toBe(1);
  });

  it("pays half on the second try and a quarter on the third", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "nope" });
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(pubOf(run).score).toBe(0.5);

    act(run, "answer_cell", { row: 0, col: 1, guess: "nope" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "still nope" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });
    expect(pubOf(run).score).toBe(0.75);
    expect(pubOf(run).cells[1]?.points).toBe(0.25);
  });

  it("pays nothing from the fourth try on, but still accepts the answer", () => {
    const run = runFresh();
    for (const guess of ["a", "b", "c"]) {
      act(run, "answer_cell", { row: 0, col: 0, guess });
    }
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });

    const cell = pubOf(run).cells[0]!;
    expect(cell.status).toBe("correct");
    expect(cell.attempts).toBe(4);
    expect(cell.points).toBe(0);
    expect(pubOf(run).score).toBe(0);
  });

  it("never locks a cell for guessing wrong — the reported complaint", () => {
    const run = runFresh();
    for (let i = 0; i < 8; i++) {
      act(run, "answer_cell", { row: 0, col: 0, guess: `wrong ${i}` });
    }
    expect(pubOf(run).cells[0]?.status).toBe("unanswered");
    expect(pubOf(run).cells[0]?.attempts).toBe(8);

    // Still answerable after all that.
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(pubOf(run).cells[0]?.status).toBe("correct");
  });

  it("keeps the score exact rather than drifting on float addition", () => {
    const run = runFresh();
    // 0.5 + 0.25 + 0.25 must be exactly 1, not 0.9999999999999999.
    act(run, "answer_cell", { row: 0, col: 0, guess: "x" });
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "x" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "y" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });
    act(run, "answer_cell", { row: 0, col: 2, guess: "x" });
    act(run, "answer_cell", { row: 0, col: 2, guess: "y" });
    act(run, "answer_cell", { row: 0, col: 2, guess: "Tokyo" });
    expect(pubOf(run).score).toBe(1);
  });

  it("skip_cell closes a cell without revealing the answer", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "nope" });
    act(run, "skip_cell", { row: 0, col: 0 });

    const cell = pubOf(run).cells[0]!;
    expect(cell.status).toBe("incorrect");
    expect(cell.answer).toBeUndefined();
    expect(pubOf(run).score).toBe(0);

    // And it really is closed now.
    expect(actErr(run, "answer_cell", { row: 0, col: 0, guess: "Paris" }).code).toBe(
      "cell_locked"
    );
  });

  it("skip_cell is what makes the grid submittable when a cell is unbeatable", () => {
    const run = runFresh();
    const answers = ["Paris", "Stockholm", "Tokyo", "London", "Einstein", "Paris", "Rome", "MLK", "Crete"];
    let i = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        // Miss the last cell forever instead of answering it.
        if (r === 2 && c === 2) {
          act(run, "answer_cell", { row: r, col: c, guess: "no idea" });
        } else {
          act(run, "answer_cell", { row: r, col: c, guess: answers[i]! });
        }
        i++;
      }
    }

    expect(actErr(run, "submit").code).toBe("incomplete");
    act(run, "skip_cell", { row: 2, col: 2 });
    act(run, "submit");
    expect(run.phase).toBe("failed");
  });

  it("solving every cell counts as solved even when some took several tries", () => {
    const run = runFresh();
    const answers = ["Paris", "Stockholm", "Tokyo", "London", "Einstein", "Paris", "Rome", "MLK", "Crete"];
    let i = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        // Every cell gets one wrong guess first, so the score is 4.5, not 9.
        act(run, "answer_cell", { row: r, col: c, guess: "wrong" });
        act(run, "answer_cell", { row: r, col: c, guess: answers[i]! });
        i++;
      }
    }
    act(run, "submit");

    // The old rule tested `score === 9`, which would have called this failed.
    expect(run.phase).toBe("solved");
    expect(pubOf(run).score).toBe(4.5);
  });

  it("shades the share grid by how many tries each cell took", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });           // first try
    act(run, "answer_cell", { row: 0, col: 1, guess: "x" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });       // second
    act(run, "reveal_cell", { row: 0, col: 2 });

    const summary = nexus.summarize(ctxOf(run), run.state);
    // Find the grid rather than indexing a fixed line — the header grew an
    // "Attempts" line and a positional assert would silently follow it.
    const firstRow = summary.shareText
      .split("\n")
      .find((line) => /[🟩🟨🟧🟦🟥⬜]|👁/u.test(line));
    expect(firstRow).toBe("🟩🟨👁️");
    expect(summary.shareText).toContain("Attempts: 3");
    expect(summary.stats.extra?.totalAttempts).toBe(3);
  });

  it("does not leak an answer through the share grid on any status", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "x" });
    act(run, "skip_cell", { row: 0, col: 1 });
    act(run, "reveal_cell", { row: 0, col: 2 });

    const { shareText } = nexus.summarize(ctxOf(run), run.state);
    for (const spec of samplePayload.cells) {
      expect(shareText).not.toContain(spec.answer);
      expect(shareText).not.toContain(spec.question);
    }
  });

  it("tolerates an attempt saved before scoring changed", () => {
    // Cells written by the previous build carry no `attempts` field. Reading
    // that as NaN would poison the score for anyone mid-puzzle at deploy.
    const run = runFresh();
    const pub = pubOf(run);
    const legacy = {
      ...pub,
      cells: pub.cells.map(({ attempts: _a, points: _p, ...rest }) => rest),
    };
    run.state = { ...run.state, publicState: legacy };

    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(pubOf(run).score).toBe(1);
    expect(pubOf(run).cells[0]?.attempts).toBe(1);
  });
});
