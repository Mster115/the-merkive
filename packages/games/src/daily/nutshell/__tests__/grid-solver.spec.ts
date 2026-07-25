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

  it("fills a grid from everyday words, not just contrived fill", () => {
    // The original search placed every across word against an empty grid and
    // only met a constraint at the down slots, so it enumerated tuples and
    // could not finish on a real vocabulary — a 10k-word dictionary ran for ten
    // minutes without converging. The only pools that worked were hand-made
    // ones containing nonsense fill, which is not shippable content. Assert an
    // ordinary vocabulary produces an ordinary grid, quickly.
    const words = [
      "ARC","MINOR","ANGLE","SCREW","SHY","ANGRY","ROLE","CREW","MASS","INCH",
      "ABOUT","BRAVE","CHAIR","DREAM","EAGLE","FLAME","GRAPE","HOUSE","IMAGE",
      "CARD","DESK","EAST","FARM","GATE","HAND","IRON","JUMP","KIND","LAMP",
      "ACE","BAT","CAT","DOG","EAR","FAN","GAP","HAT","ICE","JAR","KEY","LAP",
    ];
    const pool: WordCandidate[] = words.map((w) => ({ word: w, clue: `Clue for ${w}` }));

    const startedAt = Date.now();
    const result = solveGrid(pool);
    const elapsedMs = Date.now() - startedAt;

    expect(result).not.toBeNull();
    expect(elapsedMs).toBeLessThan(20_000);
    if (!result) return;

    // Every answer must come from the supplied pool — no invented fill.
    for (const slot of [...result.across, ...result.down]) {
      expect(words).toContain(slot.answer);
    }
    // And each slot takes a distinct word.
    const used = [...result.across, ...result.down].map((s) => s.answer);
    expect(new Set(used).size).toBe(used.length);
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
