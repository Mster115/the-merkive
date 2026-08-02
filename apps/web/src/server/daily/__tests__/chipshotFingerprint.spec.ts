import { describe, it, expect } from "vitest";
import { puzzleItems, fingerprintPuzzle } from "../fingerprint";

describe("chipshot fingerprint", () => {
  const base = { seed: "2026-08-03-chipshot", holeCount: 3, difficulty: 2, maxStrokesPerHole: 8 };

  it("fingerprints on seed alone, not the whole payload", () => {
    expect(puzzleItems("chipshot", base)).toEqual(["2026-08-03-chipshot"]);
  });

  it("is case- and whitespace-insensitive, like every other game's fingerprint", () => {
    const shouted = { ...base, seed: "  2026-08-03-CHIPSHOT  " };
    expect(fingerprintPuzzle("chipshot", base)).toBe(fingerprintPuzzle("chipshot", shouted));
  });

  it("same seed, different difficulty/holeCount/maxStrokes is still the same puzzle", () => {
    // This is deliberate: the course is generated from ctx.rng, keyed on
    // puzzleDate, not from this payload. A resubmission that only tweaks
    // difficulty for the same date is still a repeat of that date's content.
    const harder = { ...base, difficulty: 3, holeCount: 5, maxStrokesPerHole: 10 };
    expect(fingerprintPuzzle("chipshot", base)).toBe(fingerprintPuzzle("chipshot", harder));
  });

  it("different seeds are different puzzles", () => {
    const other = { ...base, seed: "2026-08-04-chipshot" };
    expect(fingerprintPuzzle("chipshot", base)).not.toBe(fingerprintPuzzle("chipshot", other));
  });

  it("empty/missing seed falls back to raw-payload hashing rather than colliding on nothing", () => {
    expect(puzzleItems("chipshot", { ...base, seed: "" })).toEqual([]);
    const a = fingerprintPuzzle("chipshot", { ...base, seed: "" });
    const b = fingerprintPuzzle("chipshot", { holeCount: 1, difficulty: 1, maxStrokesPerHole: 3, seed: "" });
    expect(a).not.toBe(b);
  });
});
