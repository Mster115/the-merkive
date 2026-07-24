import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { merkMini } from "../index";
import type { MerkMiniPayload, MerkMiniPublicState } from "../types";
import type { DailyContentPack } from "../../types";

const samplePayload: MerkMiniPayload = {
  gridPattern: [
    "#....",
    ".....",
    ".....",
    ".....",
    "....#",
  ],
  across: [
    { number: 1, row: 0, col: 1, length: 4, clue: "Clue 1A", answer: "TART" },
    { number: 5, row: 1, col: 0, length: 5, clue: "Clue 5A", answer: "HOSTS" },
    { number: 6, row: 2, col: 0, length: 5, clue: "Clue 6A", answer: "ARENA" },
    { number: 7, row: 3, col: 0, length: 5, clue: "Clue 7A", answer: "RESET" },
    { number: 8, row: 4, col: 0, length: 4, clue: "Clue 8A", answer: "ENDED" },
  ],
  down: [
    { number: 1, row: 0, col: 1, length: 5, clue: "Clue 1D", answer: "AOSEN" },
    { number: 2, row: 0, col: 2, length: 5, clue: "Clue 2D", answer: "RRESD" },
    { number: 3, row: 0, col: 3, length: 5, clue: "Clue 3D", answer: "TENTE" },
    { number: 4, row: 0, col: 4, length: 4, clue: "Clue 4D", answer: "SAST" },
    { number: 5, row: 1, col: 0, length: 4, clue: "Clue 5D", answer: "HARE" },
  ],
};

const samplePack: DailyContentPack = {
  gameId: "merk-mini",
  puzzleDate: "2026-07-24",
  payload: samplePayload,
  sourceRefs: [],
};

describe("merk-mini DailyGameModule", () => {
  it("initializes state with matching blocked cells and empty letters", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    expect(run.phase).toBe("in_progress");
    const state = run.state.publicState as MerkMiniPublicState;
    expect(state.grid[0]![0]!.blocked).toBe(true);
    expect(state.grid[4]![4]!.blocked).toBe(true);
    expect(state.grid[1]![1]!.blocked).toBe(false);
    expect(state.grid[1]![1]!.letter).toBeNull();
    expect(state.checksUsed).toBe(0);
    expect(state.revealsUsed).toBe(0);
  });

  it("fails submit when grid is incomplete or wrong with error code 'incomplete'", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const err = actErr(run, "submit");
    expect(err.code).toBe("incomplete");

    // Partially fill wrong letter
    act(run, "set_cell", { row: 0, col: 1, letter: "Z" });
    const err2 = actErr(run, "submit");
    expect(err2.code).toBe("incomplete");
  });

  it("rejects set_cell on blocked or out of bounds cells with error code 'invalid_cell'", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const err1 = actErr(run, "set_cell", { row: 0, col: 0, letter: "A" });
    expect(err1.code).toBe("invalid_cell");

    const err2 = actErr(run, "set_cell", { row: 10, col: 0, letter: "A" });
    expect(err2.code).toBe("invalid_cell");
  });

  it("fills all correct letters and successfully submits to reach solved phase", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    // Fill row 0 (TART)
    act(run, "set_cell", { row: 0, col: 1, letter: "T" });
    act(run, "set_cell", { row: 0, col: 2, letter: "A" });
    act(run, "set_cell", { row: 0, col: 3, letter: "R" });
    act(run, "set_cell", { row: 0, col: 4, letter: "T" });

    // Fill row 1 (HOSTS)
    act(run, "set_cell", { row: 1, col: 0, letter: "H" });
    act(run, "set_cell", { row: 1, col: 1, letter: "O" });
    act(run, "set_cell", { row: 1, col: 2, letter: "S" });
    act(run, "set_cell", { row: 1, col: 3, letter: "T" });
    act(run, "set_cell", { row: 1, col: 4, letter: "S" });

    // Fill row 2 (ARENA)
    act(run, "set_cell", { row: 2, col: 0, letter: "A" });
    act(run, "set_cell", { row: 2, col: 1, letter: "R" });
    act(run, "set_cell", { row: 2, col: 2, letter: "E" });
    act(run, "set_cell", { row: 2, col: 3, letter: "N" });
    act(run, "set_cell", { row: 2, col: 4, letter: "A" });

    // Fill row 3 (RESET)
    act(run, "set_cell", { row: 3, col: 0, letter: "R" });
    act(run, "set_cell", { row: 3, col: 1, letter: "E" });
    act(run, "set_cell", { row: 3, col: 2, letter: "S" });
    act(run, "set_cell", { row: 3, col: 3, letter: "E" });
    act(run, "set_cell", { row: 3, col: 4, letter: "T" });

    // Fill row 4 (ENDED)
    act(run, "set_cell", { row: 4, col: 0, letter: "E" });
    act(run, "set_cell", { row: 4, col: 1, letter: "N" });
    act(run, "set_cell", { row: 4, col: 2, letter: "D" });
    act(run, "set_cell", { row: 4, col: 3, letter: "E" });

    act(run, "submit");
    expect(run.phase).toBe("solved");
    expect(run.over).toBe(true);

    const summary = merkMini.summarize(ctxOf(run), run.state);
    expect(summary.status).toBe("solved");
    expect(summary.stats.completed).toBe(true);
  });

  it("handles check_cell, check_all, and reveal_cell while tracking counts", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    act(run, "set_cell", { row: 0, col: 1, letter: "X" }); // wrong
    act(run, "check_cell", { row: 0, col: 1 });

    let state = run.state.publicState as MerkMiniPublicState;
    expect(state.checksUsed).toBe(1);
    expect(state.grid[0]![1]!.checked).toBe(true);
    expect(state.grid[0]![1]!.correct).toBe(false);

    act(run, "reveal_cell", { row: 0, col: 1 });
    state = run.state.publicState as MerkMiniPublicState;
    expect(state.revealsUsed).toBe(1);
    expect(state.grid[0]![1]!.letter).toBe("T");
    expect(state.grid[0]![1]!.revealed).toBe(true);

    act(run, "check_all");
    state = run.state.publicState as MerkMiniPublicState;
    expect(state.checksUsed).toBe(2);
  });

  it("rejects mutating actions once the attempt is over, but submit/give_up stay idempotent no-ops", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    act(run, "give_up");
    expect(run.phase).toBe("failed");

    const err1 = actErr(run, "set_cell", { row: 0, col: 1, letter: "T" });
    expect(err1.code).toBe("attempt_over");

    const err2 = actErr(run, "reveal_cell", { row: 0, col: 1 });
    expect(err2.code).toBe("attempt_over");

    const err3 = actErr(run, "check_all");
    expect(err3.code).toBe("attempt_over");

    const before = run.state.publicState as MerkMiniPublicState;
    act(run, "give_up"); // idempotent no-op, not an error
    const after = run.state.publicState as MerkMiniPublicState;
    expect(after.revealsUsed).toBe(before.revealsUsed);
    expect(after.checksUsed).toBe(before.checksUsed);
  });

  it("summarize never leaks answer letters in shareText", () => {
    const run = createDailyTestRun(merkMini, {
      puzzleDate: "2026-07-24",
      pack: samplePack,
    });

    const inProgressSummary = merkMini.summarize(ctxOf(run), run.state);
    expect(inProgressSummary.shareText).not.toContain("TART");
    expect(inProgressSummary.shareText).not.toContain("HOSTS");
    expect(inProgressSummary.shareText).toContain("Merk Mini — 2026-07-24");

    act(run, "give_up");
    const failedSummary = merkMini.summarize(ctxOf(run), run.state);
    expect(failedSummary.status).toBe("failed");
    expect(failedSummary.shareText).not.toContain("TART");
    expect(failedSummary.shareText).not.toContain("HOSTS");
  });
});
