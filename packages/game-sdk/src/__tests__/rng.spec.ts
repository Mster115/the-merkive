import { describe, expect, it } from "vitest";
import { matchRng, seededRng, shuffled } from "../rng";

describe("seeded rng", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRng("hello");
    const b = seededRng("hello");
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds and versions", () => {
    expect(seededRng("a")()).not.toBe(seededRng("b")());
    expect(matchRng("seed", 1)()).not.toBe(matchRng("seed", 2)());
  });

  it("stays in [0,1)", () => {
    const rng = seededRng("range");
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("shuffles deterministically without losing elements", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffled(items, seededRng("s"));
    const b = shuffled(items, seededRng("s"));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items); // vanishingly unlikely for 20 elements
  });
});
