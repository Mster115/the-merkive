import { describe, it, expect } from "vitest";
import { matchRng } from "@merky/game-sdk";
import { dailyGameList, dailyGameRegistry } from "../index";

describe("daily game registry (platform CI gate)", () => {
  it("meta ids are unique and match registry keys", () => {
    const ids = dailyGameList.map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, mod] of Object.entries(dailyGameRegistry)) {
      expect(mod.meta.id).toBe(key);
    }
  });

  it("every daily game ships english strings for name/description keys", () => {
    for (const g of dailyGameList) {
      const en = g.i18n.en ?? {};
      expect(Object.prototype.hasOwnProperty.call(en, g.meta.nameKey), `${g.meta.id} missing ${g.meta.nameKey}`).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(en, g.meta.descriptionKey), `${g.meta.id} missing ${g.meta.descriptionKey}`).toBe(true);
    }
  });

  it("required plugin surface is present for every daily game", () => {
    for (const g of dailyGameList) {
      expect(typeof g.init).toBe("function");
      expect(typeof g.reduce).toBe("function");
      expect(typeof g.summarize).toBe("function");
      expect(typeof g.validatePack).toBe("function");
      expect(typeof g.generatePrompt).toBe("function");
      expect(g.ui?.Play).toBeTruthy();
    }
  });

  it("matchRng produces identical sequences given the same seed and version", () => {
    const rng1 = matchRng("test-seed", 0);
    const rng2 = matchRng("test-seed", 0);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).toEqual(seq2);
    expect(seq1.length).toBe(5);
  });
});
