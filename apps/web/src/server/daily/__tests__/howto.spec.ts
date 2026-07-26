import { describe, it, expect, beforeEach } from "vitest";
import { dailyGameList, getDailyGame } from "@merky/games/daily";
import { resetDailyStore, getDailyStore } from "../store";
import { MemoryDailyStore } from "../store/memory";
import * as service from "../service";
import { ServiceError } from "../../errors";

/**
 * The how-to "seen" flag lives on the device row rather than in browser
 * storage, so it survives a recovery-code restore onto a new device. These
 * cover the flag's own behaviour; the modal wiring is in DailyPlayShell.
 */
describe("how-to-play seen flag", () => {
  beforeEach(() => {
    resetDailyStore(new MemoryDailyStore());
  });

  it("starts unseen for a device that has never opened the game", async () => {
    const store = getDailyStore();
    await store.upsertDevice("device-1", "UTC");

    const device = await store.getDevice("device-1");
    expect(device?.seen_howto ?? []).toEqual([]);
  });

  it("records a game as seen", async () => {
    const store = getDailyStore();
    await store.upsertDevice("device-1", "UTC");

    await service.markHowToSeen("device-1", "relay");

    const device = await store.getDevice("device-1");
    expect(device?.seen_howto).toEqual(["relay"]);
  });

  it("is idempotent, so the client can fire it on every close", async () => {
    const store = getDailyStore();
    await store.upsertDevice("device-1", "UTC");

    await service.markHowToSeen("device-1", "relay");
    await service.markHowToSeen("device-1", "relay");
    await service.markHowToSeen("device-1", "relay");

    const device = await store.getDevice("device-1");
    expect(device?.seen_howto).toEqual(["relay"]);
  });

  it("tracks each game separately", async () => {
    const store = getDailyStore();
    await store.upsertDevice("device-1", "UTC");

    await service.markHowToSeen("device-1", "relay");
    await service.markHowToSeen("device-1", "nexus");

    const device = await store.getDevice("device-1");
    expect(device?.seen_howto?.sort()).toEqual(["nexus", "relay"]);
  });

  it("does not leak between devices", async () => {
    const store = getDailyStore();
    await store.upsertDevice("device-1", "UTC");
    await store.upsertDevice("device-2", "UTC");

    await service.markHowToSeen("device-1", "relay");

    expect((await store.getDevice("device-2"))?.seen_howto ?? []).toEqual([]);
  });

  it("rejects an unknown game rather than writing junk onto the device", async () => {
    const store = getDailyStore();
    await store.upsertDevice("device-1", "UTC");

    await expect(service.markHowToSeen("device-1", "not-a-game")).rejects.toThrow(
      ServiceError
    );
    expect((await store.getDevice("device-1"))?.seen_howto ?? []).toEqual([]);
  });
});

describe("how-to-play component coverage", () => {
  it("every registered daily game ships a HowToPlay", () => {
    // A solo game has no host to explain itself and no other players to copy,
    // so shipping one without rules strands the player — see the daily README.
    const missing = dailyGameList
      .filter((g) => !g.ui.HowToPlay)
      .map((g) => g.meta.id);
    expect(missing).toEqual([]);
  });

  it("keeps its how-to strings under the game's own i18n namespace", () => {
    for (const game of dailyGameList) {
      const en = game.i18n.en ?? {};
      const howToKeys = Object.keys(en).filter((k) => k.includes(".howto."));
      expect(howToKeys.length).toBeGreaterThan(0);
      for (const key of howToKeys) {
        expect(key.startsWith(`daily.${game.meta.id}.howto.`)).toBe(true);
      }
    }
  });

  it("exposes HowToPlay through the registry lookup the shell uses", () => {
    for (const game of dailyGameList) {
      expect(getDailyGame(game.meta.id)?.ui.HowToPlay).toBeTruthy();
    }
  });
});
