import { describe, it, expect } from "vitest";
import { gameList, gameRegistry } from "../index";

describe("game registry (platform CI gate)", () => {
  it("has at least the three launch games", () => {
    expect(Object.keys(gameRegistry)).toEqual(
      expect.arrayContaining(["zaplash", "tiletangle", "eightstorm"])
    );
  });

  it("meta ids are unique and match registry keys", () => {
    const ids = gameList.map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, mod] of Object.entries(gameRegistry)) {
      expect(mod.meta.id).toBe(key);
    }
  });

  it("player bounds respect the platform cap (2..8)", () => {
    for (const g of gameList) {
      expect(g.meta.minPlayers).toBeGreaterThanOrEqual(2);
      expect(g.meta.maxPlayers).toBeLessThanOrEqual(8);
      expect(g.meta.minPlayers).toBeLessThanOrEqual(g.meta.maxPlayers);
    }
  });

  it("every game ships english strings for its name/description keys", () => {
    for (const g of gameList) {
      const en = g.i18n.en ?? {};
      expect(en[g.meta.nameKey], `${g.meta.id} missing ${g.meta.nameKey}`).toBeTruthy();
      expect(en[g.meta.descriptionKey], `${g.meta.id} missing ${g.meta.descriptionKey}`).toBeTruthy();
    }
  });

  it("every game ships a lobby how-to-play summary (GameInfoModal contract)", () => {
    for (const g of gameList) {
      const en = g.i18n.en ?? {};
      const key = `games.${g.meta.id}.lobby.rules_summary`;
      expect(en[key], `${g.meta.id} missing ${key}`).toBeTruthy();
    }
  });

  it("every settingField labelKey resolves to an english string", () => {
    for (const g of gameList) {
      const en = g.i18n.en ?? {};
      for (const f of g.meta.settingFields) {
        expect(en[f.labelKey], `${g.meta.id} missing ${f.labelKey}`).toBeTruthy();
        if (f.type === "select") {
          for (const o of f.options) {
            expect(en[o.labelKey], `${g.meta.id} missing ${o.labelKey}`).toBeTruthy();
          }
        }
      }
    }
  });

  it("required plugin surface is present", () => {
    for (const g of gameList) {
      expect(typeof g.init).toBe("function");
      expect(typeof g.reduce).toBe("function");
      expect(typeof g.awaitedSeats).toBe("function");
      expect(g.ui.Stage).toBeTruthy();
      expect(g.ui.Controller).toBeTruthy();
    }
  });
});
