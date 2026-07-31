import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { nexus } from "../index";
import { getDailyGame } from "../../index";
import {
  buildHintMask,
  NEXUS_MAX_HINT_LENGTH,
  validatePack,
  normalizeAnswer,
  wordsToNumber,
  isOneEditAway,
} from "../utils";
import type { DailyContentPack } from "../../types";
import type { NexusPublicState, NexusPayload, NexusSecretState } from "../types";
import { NEXUS_MAX_HINTS, NEXUS_MAX_LOGGED_MISSES } from "../types";

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

/**
 * Every case here comes from players saying "I answered that correctly and it
 * told me I was wrong" — plus the guards that keep the fix from swinging so
 * far the other way that a different answer starts scoring.
 */
describe("nexus answer grading — what counts as the same answer", () => {
  /** A pack whose (0,0) cell has one canonical answer and nothing else. */
  const packWithKey = (answer: string, acceptableAnswers: string[] = []) => {
    const p = JSON.parse(JSON.stringify(samplePack)) as DailyContentPack;
    const payload = p.payload as NexusPayload;
    payload.cells[0]!.answer = answer;
    payload.cells[0]!.acceptableAnswers = acceptableAnswers;
    return p;
  };

  const grade = (answer: string, guess: string, acceptable: string[] = []) => {
    const run = createDailyTestRun(nexus, {
      puzzleDate: "2026-07-24",
      pack: packWithKey(answer, acceptable),
    });
    const res = nexus.reduce(ctxOf(run), run.state, {
      type: "answer_cell",
      payload: { row: 0, col: 0, guess },
    });
    if ("error" in res) return res.code;
    const cells = (res.publicState as NexusPublicState).cells;
    return cells[0]!.status === "correct" ? "correct" : "wrong";
  };

  it("accepts a full name when the key is only the surname", () => {
    // Reported: the key was "Chaplin", a player typed "Charlie Chaplin" and
    // was marked wrong for knowing more.
    expect(grade("Chaplin", "Charlie Chaplin")).toBe("correct");
    expect(grade("Erie", "Lake Erie")).toBe("correct");
  });

  it("accepts a surname when the key is the full name", () => {
    expect(grade("Charlie Chaplin", "Chaplin")).toBe("correct");
    expect(grade("Albert Einstein", "Einstein")).toBe("correct");
  });

  it("still requires the qualifier that decides which answer it is", () => {
    expect(grade("North Korea", "Korea")).toBe("wrong");
    expect(grade("New Zealand", "Zealand")).toBe("wrong");
    expect(grade("Stanley Cup", "Cup")).toBe("wrong");
  });

  it("does not accept the franchise for the film", () => {
    // Reported the other way round: "Lord of the Rings" for a key of "The
    // Return of the King". It shares no distinctive word with the key, and
    // three-plus-word keys are outside the drop-a-word rule entirely.
    expect(grade("The Return of the King", "The Lord of the Rings")).toBe("wrong");
    expect(grade("The Return of the King", "Rings")).toBe("wrong");
  });

  it("ignores punctuation, accents, and editorial parentheticals", () => {
    expect(grade("Beyoncé", "Beyonce")).toBe("correct");
    expect(grade("Beyonce", "Beyoncé")).toBe("correct");
    expect(grade("Dr. Seuss", "Dr Seuss")).toBe("correct");
    expect(grade("Wall-E", "Wall E")).toBe("correct");
    expect(grade("O'Brien", "OBrien")).toBe("correct");
    expect(grade("Mercury (planet)", "Mercury")).toBe("correct");
    expect(grade("Rock & Roll Hall of Fame", "Rock and Roll Hall of Fame")).toBe(
      "correct"
    );
  });

  it("does not let a hedged guess score by containing the answer", () => {
    expect(grade("Mercury", "Mercury or Venus")).toBe("wrong");
  });

  it("keeps numbers exact — a longer number is a different number", () => {
    expect(grade("four", "four hundred")).toBe("wrong");
    expect(grade("4", "four")).toBe("correct");
  });

  it("does not let an extra word carry a guess past a short key", () => {
    // "Rome" survives; "the city Rom" must not become a match by containment.
    expect(grade("Rome", "Rom City")).toBe("wrong");
  });
});

/**
 * From player feedback: Nexus is the most interesting of the daily games and by
 * far the hardest, and a stuck square had nothing between "keep guessing" and
 * "reveal it and forfeit the grid". The hint ladder is that missing rung, and
 * the thing that makes it a rung rather than a second reveal is that a hinted
 * square still counts as solved.
 */
describe("nexus hint ladder", () => {
  const runFresh = () =>
    createDailyTestRun(nexus, { puzzleDate: "2026-07-24", pack: samplePack });
  const pubOf = (run: ReturnType<typeof runFresh>) =>
    run.state.publicState as NexusPublicState;
  const cellAt = (run: ReturnType<typeof runFresh>, row: number, col: number) =>
    pubOf(run).cells.find((c) => c.row === row && c.col === col);

  it("costs exactly what a wrong guess costs", () => {
    const run = runFresh();
    act(run, "hint_cell", { row: 0, col: 1 });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });

    const cell = cellAt(run, 0, 1);
    expect(cell?.status).toBe("correct");
    expect(cell?.points).toBe(0.5);
    expect(pubOf(run).score).toBe(0.5);
  });

  it("compounds with misses down the one ladder", () => {
    const run = runFresh();
    act(run, "hint_cell", { row: 0, col: 1 });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Gothenburg" });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });

    expect(cellAt(run, 0, 1)?.points).toBe(0.25);
    expect(pubOf(run).score).toBe(0.25);
  });

  it("climbs the rungs: shape, then initials, then every other letter", () => {
    const run = runFresh();

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintMask).toBe("▢▢▢▢▢▢▢▢▢");

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintMask).toBe("S▢▢▢▢▢▢▢▢");

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintMask).toBe("S▢o▢k▢o▢m");
    expect(cellAt(run, 0, 1)?.hints).toBe(NEXUS_MAX_HINTS);
  });

  it("leaves the square answerable at the bottom of the ladder", () => {
    const run = runFresh();
    for (let i = 0; i < NEXUS_MAX_HINTS; i++) {
      act(run, "hint_cell", { row: 0, col: 1 });
    }

    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });
    expect(cellAt(run, 0, 1)?.status).toBe("correct");
    expect(pubOf(run).score).toBe(0);
  });

  it("refuses a fourth hint rather than handing the answer over", () => {
    const run = runFresh();
    for (let i = 0; i < NEXUS_MAX_HINTS; i++) {
      act(run, "hint_cell", { row: 0, col: 1 });
    }
    const before = JSON.stringify(run.state.publicState);

    expect(actErr(run, "hint_cell", { row: 0, col: 1 }).code).toBe("no_hints_left");
    expect(JSON.stringify(run.state.publicState)).toBe(before);
  });

  it("refuses a hint on a cell that is already settled", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(actErr(run, "hint_cell", { row: 0, col: 0 }).code).toBe("cell_locked");

    act(run, "skip_cell", { row: 0, col: 1 });
    expect(actErr(run, "hint_cell", { row: 0, col: 1 }).code).toBe("cell_locked");
  });

  it("still reaches `solved` when every square was hinted", () => {
    // The whole point of the ladder. `reveal_cell` forfeits the grid; a hint
    // must not, or it is just a slower reveal and the feedback goes unanswered.
    const run = runFresh();
    for (const spec of samplePayload.cells) {
      act(run, "hint_cell", { row: spec.row, col: spec.col });
      act(run, "answer_cell", {
        row: spec.row,
        col: spec.col,
        guess: spec.answer,
      });
    }
    act(run, "submit");

    expect(run.state.phase).toBe("solved");
    expect(pubOf(run).score).toBe(4.5);
    expect(nexus.summarize(ctxOf(run), run.state).status).toBe("solved");
  });

  it("shades the share grid by what the square cost, and counts the hints", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" }); // clean
    act(run, "hint_cell", { row: 0, col: 1 });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" }); // hinted
    act(run, "hint_cell", { row: 0, col: 2 });
    act(run, "hint_cell", { row: 0, col: 2 });
    act(run, "answer_cell", { row: 0, col: 2, guess: "Tokyo" }); // twice-hinted

    const summary = nexus.summarize(ctxOf(run), run.state);
    const firstRow = summary.shareText
      .split("\n")
      .find((line) => /[🟩🟨🟧🟦🟥⬜]|👁/u.test(line));
    expect(firstRow).toBe("🟩🟨🟧");
    expect(summary.stats.extra?.hintsUsed).toBe(3);
  });

  it("never leaks the answer through publicState or the share text", () => {
    const run = runFresh();
    // Two rungs on every cell — the most a player can see without answering.
    for (const spec of samplePayload.cells) {
      act(run, "hint_cell", { row: spec.row, col: spec.col });
      act(run, "hint_cell", { row: spec.row, col: spec.col });
    }

    // Scoped to the masks and the share text rather than the whole of
    // publicState: the questions are broadcast by design, and this fixture has
    // one whose text contains its own answer ("London physics lab").
    const masks = JSON.stringify(pubOf(run).cells.map((c) => c.hintMask));
    const { shareText } = nexus.summarize(ctxOf(run), run.state);
    for (const spec of samplePayload.cells) {
      expect(masks).not.toContain(spec.answer);
      expect(shareText).not.toContain(spec.answer);
    }
    expect(JSON.stringify(pubOf(run).cells.map((c) => c.answer))).not.toContain(
      "Stockholm"
    );
  });

  it("tolerates an attempt saved before hints existed", () => {
    const run = runFresh();
    const pub = pubOf(run);
    run.state = {
      ...run.state,
      publicState: {
        ...pub,
        cells: pub.cells.map(({ attempts: _a, hints: _h, ...rest }) => rest),
      },
    };

    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });
    expect(pubOf(run).score).toBe(1);

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hints).toBe(1);
  });
});

/**
 * The authored nudge is rung 0 of the same ladder: prose the content pipeline
 * writes, ahead of the computed masks. A cell without one is unchanged.
 */
describe("nexus authored hint", () => {
  /** The sample pack with an authored nudge on cell (0,1), answer "Stockholm". */
  const packWithHint = (hint: string): DailyContentPack => {
    const p = JSON.parse(JSON.stringify(samplePack)) as DailyContentPack;
    const payload = p.payload as NexusPayload;
    const cell = payload.cells.find((c) => c.row === 0 && c.col === 1)!;
    cell.hint = hint;
    return p;
  };

  const runWith = (hint: string) =>
    createDailyTestRun(nexus, { puzzleDate: "2026-07-24", pack: packWithHint(hint) });
  const cellAt = (run: ReturnType<typeof runWith>, row: number, col: number) =>
    (run.state.publicState as NexusPublicState).cells.find(
      (c) => c.row === row && c.col === col
    );

  const NUDGE = "The city that hands out most of the science prizes";

  it("publishes the rung count up front without publishing the nudge", () => {
    const run = runWith(NUDGE);
    // The player has to know how many rungs a square has before spending one,
    // but the text itself stays behind the paywall.
    expect(cellAt(run, 0, 1)?.hintsAvailable).toBe(NEXUS_MAX_HINTS + 1);
    expect(cellAt(run, 0, 0)?.hintsAvailable).toBe(NEXUS_MAX_HINTS);
    expect(JSON.stringify(run.state.publicState)).not.toContain(NUDGE);
  });

  it("takes the first rung, pushing the masks back one", () => {
    const run = runWith(NUDGE);

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintText).toBe(NUDGE);
    expect(cellAt(run, 0, 1)?.hintMask).toBeUndefined();

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintMask).toBe("▢▢▢▢▢▢▢▢▢");
    // The nudge stays on the cell — paying a step must never lose information.
    expect(cellAt(run, 0, 1)?.hintText).toBe(NUDGE);

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintMask).toBe("S▢▢▢▢▢▢▢▢");

    act(run, "hint_cell", { row: 0, col: 1 });
    expect(cellAt(run, 0, 1)?.hintMask).toBe("S▢o▢k▢o▢m");
  });

  it("costs a step like any other rung, and still scores as correct", () => {
    const run = runWith(NUDGE);
    act(run, "hint_cell", { row: 0, col: 1 });
    act(run, "answer_cell", { row: 0, col: 1, guess: "Stockholm" });

    expect(cellAt(run, 0, 1)?.status).toBe("correct");
    expect(cellAt(run, 0, 1)?.points).toBe(0.5);
  });

  it("caps one rung higher than a cell without a nudge", () => {
    const run = runWith(NUDGE);
    for (let i = 0; i < NEXUS_MAX_HINTS + 1; i++) {
      act(run, "hint_cell", { row: 0, col: 1 });
    }
    expect(actErr(run, "hint_cell", { row: 0, col: 1 }).code).toBe("no_hints_left");

    // The neighbouring cell ships no nudge and still stops at three.
    for (let i = 0; i < NEXUS_MAX_HINTS; i++) {
      act(run, "hint_cell", { row: 0, col: 0 });
    }
    expect(actErr(run, "hint_cell", { row: 0, col: 0 }).code).toBe("no_hints_left");
  });

  it("reads the cap off the pack, so an attempt saved before nudges still gets one", () => {
    const run = runWith(NUDGE);
    const pub = run.state.publicState as NexusPublicState;
    run.state = {
      ...run.state,
      publicState: {
        ...pub,
        cells: pub.cells.map(({ hintsAvailable: _h, ...rest }) => rest),
      },
    };

    for (let i = 0; i < NEXUS_MAX_HINTS + 1; i++) {
      act(run, "hint_cell", { row: 0, col: 1 });
    }
    expect(cellAt(run, 0, 1)?.hints).toBe(NEXUS_MAX_HINTS + 1);
    expect(cellAt(run, 0, 1)?.hintText).toBe(NUDGE);
  });

  it("keeps the field through validatePack, which rebuilds the payload", () => {
    const res = validatePack(packWithHint(NUDGE), "2026-07-24");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const cells = (res.pack.payload as NexusPayload).cells;
    expect(cells.find((c) => c.row === 0 && c.col === 1)?.hint).toBe(NUDGE);
    // Absent everywhere else rather than defaulted to an empty string.
    expect(cells.find((c) => c.row === 0 && c.col === 0)?.hint).toBeUndefined();
  });

  it("rejects a nudge that names the answer it is hinting at", () => {
    // The player pays a scoring step for this. Handing back the answer they
    // were already owed is worse than shipping no hint at all.
    const bad = validatePack(packWithHint("Stockholm hosts the ceremony"), "2026-07-24");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("contains the answer");

    // Normalization applies, so case and punctuation cannot sneak it past.
    expect(validatePack(packWithHint("it is STOCKHOLM!"), "2026-07-24").ok).toBe(false);
  });

  it("rejects a nudge that is not a string or runs long", () => {
    const longHint = "x".repeat(NEXUS_MAX_HINT_LENGTH + 1);
    expect(validatePack(packWithHint(longHint), "2026-07-24").ok).toBe(false);

    const wrongType = JSON.parse(JSON.stringify(samplePack)) as DailyContentPack;
    (wrongType.payload as NexusPayload).cells[1]!.hint = 42 as unknown as string;
    expect(validatePack(wrongType, "2026-07-24").ok).toBe(false);
  });

  it("treats a blank nudge as no nudge rather than an empty rung", () => {
    const res = validatePack(packWithHint("   "), "2026-07-24");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const cells = (res.pack.payload as NexusPayload).cells;
    expect(cells.find((c) => c.row === 0 && c.col === 1)?.hint).toBeUndefined();
  });
});

describe("buildHintMask", () => {
  it("hides everything but the shape at the first rung", () => {
    expect(buildHintMask("Albert Einstein", 1)).toBe("▢▢▢▢▢▢ ▢▢▢▢▢▢▢▢");
  });

  it("opens the first letter of each word at the second", () => {
    expect(buildHintMask("Albert Einstein", 2)).toBe("A▢▢▢▢▢ E▢▢▢▢▢▢▢");
  });

  it("keeps punctuation and spacing visible as structure", () => {
    expect(buildHintMask("Wall-E", 2)).toBe("W▢▢▢-E");
    expect(buildHintMask("O'Brien", 2)).toBe("O'B▢▢▢▢");
    expect(buildHintMask("Rock & Roll", 2)).toBe("R▢▢▢ & R▢▢▢");
  });

  it("masks digits too, so a date is not handed over as 'shape'", () => {
    expect(buildHintMask("Apollo 11", 1)).toBe("▢▢▢▢▢▢ ▢▢");
    expect(buildHintMask("Apollo 11", 2)).toBe("A▢▢▢▢▢ 1▢");
  });

  it("drops an editorial parenthetical the grader ignores anyway", () => {
    expect(buildHintMask("Mercury (planet)", 1)).toBe("▢▢▢▢▢▢▢");
  });

  it("keeps accents on the letters it shows", () => {
    expect(buildHintMask("Beyoncé", 3)).toBe("B▢y▢n▢é");
  });

  it("is deterministic — the same answer and rung give the same mask", () => {
    expect(buildHintMask("Stockholm", 3)).toBe(buildHintMask("Stockholm", 3));
  });

  it("survives a degenerate answer instead of throwing", () => {
    expect(buildHintMask("", 2)).toBe("");
    expect(buildHintMask("(note)", 1)).toBe("");
    expect(buildHintMask("Rome", 0)).toBe("▢▢▢▢");
  });
});

describe("nexus miss log", () => {
  const runFresh = () =>
    createDailyTestRun(nexus, { puzzleDate: "2026-07-24", pack: samplePack });

  const missesOf = (run: ReturnType<typeof runFresh>) =>
    (run.state.secretState as NexusSecretState).misses ?? [];

  it("records what a rejected guess actually said, server-side only", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 1, guess: "Gothenburg" });

    expect(missesOf(run)).toEqual([{ row: 0, col: 1, guess: "Gothenburg" }]);
    // publicState is broadcast verbatim — the log must not ride along.
    expect(JSON.stringify(run.state.publicState)).not.toContain("Gothenburg");
  });

  it("logs nothing for a correct answer and keeps the pack intact", () => {
    const run = runFresh();
    act(run, "answer_cell", { row: 0, col: 0, guess: "Paris" });

    expect(missesOf(run)).toEqual([]);
    const secret = run.state.secretState as NexusSecretState;
    expect(secret.cells).toHaveLength(9);
    expect(secret.rowLabels).toEqual(samplePayload.rowLabels);
  });

  it("caps the log so repeated guessing cannot inflate the stored attempt", () => {
    const run = runFresh();
    for (let i = 0; i < NEXUS_MAX_LOGGED_MISSES + 12; i++) {
      act(run, "answer_cell", { row: 0, col: 1, guess: `wrong-${i}` });
    }
    const misses = missesOf(run);
    expect(misses).toHaveLength(NEXUS_MAX_LOGGED_MISSES);
    // Keeps the most recent, drops the oldest.
    expect(misses[misses.length - 1]?.guess).toBe(
      `wrong-${NEXUS_MAX_LOGGED_MISSES + 11}`
    );
  });
});
