import { describe, it, expect } from "vitest";
import { solveGrid } from "../grid-solver";
import type { WordCandidate } from "../types";

describe("grid-solver for nutshell", () => {
  it("solves a grid given a valid candidate pool and verifies crossing cells agree", () => {
    const pool: WordCandidate[] = [
      { word: "START", clue: "Begin" },
      { word: "HOSTS", clue: "Entertains" },
      { word: "ARENA", clue: "Stadium" },
      { word: "RESET", clue: "Restart" },
      { word: "ENDED", clue: "Finished" },
      { word: "SHARE", clue: "Distribute" },
      { word: "TOREN", clue: "Tower" },
      { word: "ASESD", clue: "Word 8" },
      { word: "RTNEE", clue: "Word 9" },
      { word: "TSATD", clue: "Word 10" },
      { word: "EXTRA", clue: "Bonus word" },
      { word: "ITEMS", clue: "Things" },
    ];

    const result = solveGrid(pool);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.gridPattern.length).toBe(5);
    expect(result.across.length).toBeGreaterThan(0);
    expect(result.down.length).toBeGreaterThan(0);

    // Verify all across and down words intersect properly
    for (const a of result.across) {
      for (let i = 0; i < a.length; i++) {
        const r = a.row;
        const c = a.col + i;
        const letterAcross = a.answer[i];

        // Find matching down word covering cell (r, c)
        const matchingDown = result.down.find(
          (d) => d.col === c && r >= d.row && r < d.row + d.length
        );
        expect(matchingDown).toBeDefined();
        if (matchingDown) {
          const letterDown = matchingDown.answer[r - matchingDown.row];
          expect(letterAcross).toBe(letterDown);
        }
      }
    }
  });

  it("returns null for an unsolvable pool without throwing or hanging", () => {
    const unsolvablePool: WordCandidate[] = [
      { word: "AAAAA", clue: "All A" },
      { word: "BBBBB", clue: "All B" },
      { word: "CCCCC", clue: "All C" },
      { word: "DDDDD", clue: "All D" },
    ];

    const result = solveGrid(unsolvablePool, { maxSteps: 500 });
    expect(result).toBeNull();
  });

  it("produces identical results given the same candidate pool (determinism check)", () => {
    const pool: WordCandidate[] = [
      { word: "START", clue: "Begin" },
      { word: "HOSTS", clue: "Entertains" },
      { word: "ARENA", clue: "Stadium" },
      { word: "RESET", clue: "Restart" },
      { word: "ENDED", clue: "Finished" },
      { word: "SHARE", clue: "Distribute" },
      { word: "TOREN", clue: "Tower" },
      { word: "ASESD", clue: "Word 8" },
      { word: "RTNEE", clue: "Word 9" },
      { word: "TSATD", clue: "Word 10" },
    ];

    const run1 = solveGrid(pool);
    const run2 = solveGrid(pool);

    expect(run1).not.toBeNull();
    expect(run1).toEqual(run2);
  });
});
