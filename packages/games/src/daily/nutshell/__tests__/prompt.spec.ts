import { describe, it, expect } from "vitest";
import { generatePrompt, lengthHistogram, pickRecommendedPattern } from "../prompt";
import { PATTERN_LIBRARY } from "../patterns";
import { solveGrid } from "../grid-solver";
import { nutshell } from "../index";

describe("nutshell content brief", () => {
  it("recommends a pattern with the fewest five-letter slots", () => {
    const picked = pickRecommendedPattern();
    const pickedFives = lengthHistogram(picked)[5] ?? 0;

    for (const pattern of PATTERN_LIBRARY) {
      expect(pickedFives).toBeLessThanOrEqual(lengthHistogram(pattern)[5] ?? 0);
    }
  });

  it("derives its geometry from the pattern library rather than restating it", () => {
    // A hand-written brief drifts the moment PATTERN_LIBRARY is reordered or a
    // pattern is reshaped, and nothing fails — the generator just receives a
    // layout that no longer exists. Assert the printed geometry is the real one.
    const pattern = pickRecommendedPattern();
    const prompt = generatePrompt("2026-07-27");

    expect(prompt).toContain("2026-07-27");
    for (const row of pattern.gridPattern) {
      expect(prompt).toContain(row);
    }
    for (const slot of [...pattern.across, ...pattern.down]) {
      expect(prompt).toContain(`(row ${slot.row}, col ${slot.col}) length ${slot.length}`);
    }

    const hist = lengthHistogram(pattern);
    for (const [len, count] of Object.entries(hist)) {
      expect(prompt).toContain(`${count} ${len}-letter`);
    }
  });

  it("tracks a changed library instead of naming a fixed pattern", () => {
    const onlyOpen = PATTERN_LIBRARY.filter((p) => p.id === "all_open");
    expect(pickRecommendedPattern(onlyOpen).id).toBe("all_open");
  });

  it("asks for a constructed grid, not a pool to search", () => {
    // The whole point of the rewrite: pools of everyday words do not contain a
    // valid fill, so a brief that asks for one produces rejected submissions.
    const prompt = generatePrompt("2026-07-27");
    expect(prompt).toMatch(/design the interlocking grid yourself/i);
    expect(prompt).toMatch(/verifies a construction; it does not discover one/i);
    expect(prompt).not.toMatch(/pool of \d+-\d+ candidate/i);
  });

  it("ships a worked example the solver actually accepts", () => {
    // The example is the one part of the brief a constructor copies verbatim.
    // If it stops interlocking, everything downstream inherits the mistake.
    const prompt = generatePrompt("2026-07-27");
    const match = prompt.match(/across: (.+)\n\s+down:\s+(.+)/);
    if (!match) return; // no example for the recommended pattern — allowed

    const words = [...match[1]!.split(", "), ...match[2]!.split(", ")].map((w) => w.trim());
    expect(new Set(words).size).toBe(words.length);

    const solved = solveGrid(words.map((word) => ({ word, clue: `Clue for ${word}` })));
    expect(solved).not.toBeNull();
    for (const slot of [...solved!.across, ...solved!.down]) {
      expect(words).toContain(slot.answer);
    }
  });

  it("is wired into the game module", () => {
    expect(nutshell.generatePrompt("2026-07-27")).toBe(generatePrompt("2026-07-27"));
  });
});
