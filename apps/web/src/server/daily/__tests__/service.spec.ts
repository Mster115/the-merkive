import { describe, it, expect, beforeEach } from "vitest";
import { dailyGameList } from "@merky/games/daily";
import { resetDailyStore } from "../store";
import { MemoryDailyStore } from "../store/memory";
import * as service from "../service";
import { ServiceError } from "../../errors";

describe("daily service layer", () => {
  beforeEach(() => {
    resetDailyStore(new MemoryDailyStore());
  });

  it("listGames returns the meta of every registered daily game", () => {
    const games = service.listGames();
    expect(games.map((g) => g.id).sort()).toEqual(
      dailyGameList.map((g) => g.meta.id).sort()
    );
  });

  it("getTodayOrCreateAttempt throws 404 if game is unknown", async () => {
    await expect(
      service.getTodayOrCreateAttempt("unknown-game", "device-1", "UTC")
    ).rejects.toThrow(ServiceError);
  });

  it("getQueueStatus returns status for all registered games or single game", async () => {
    const status = await service.getQueueStatus();
    expect(Object.keys(status).sort()).toEqual(
      dailyGameList.map((g) => g.meta.id).sort()
    );
    for (const entry of Object.values(status)) {
      expect(entry.queuedFutureDays).toBe(0);
      expect(entry.isSufficient).toBe(false);
    }

    const [first] = dailyGameList;
    if (first) {
      const single = await service.getQueueStatus(first.meta.id);
      expect(Object.keys(single)).toEqual([first.meta.id]);
    }
  });

  it("listDrafts returns empty array initially", async () => {
    const drafts = await service.listDrafts();
    expect(drafts).toEqual([]);
  });

  it("decideDraft handles approve and reject gracefully", async () => {
    const store = new MemoryDailyStore();
    resetDailyStore(store);

    await store.insertPack(
      {
        gameId: "test-game",
        puzzleDate: "2026-07-25",
        payload: {},
        sourceRefs: [],
      },
      "draft",
      null
    );

    const drafts = await service.listDrafts();
    expect(drafts).toHaveLength(1);
    const draftId = drafts[0]!.id;

    await service.decideDraft(draftId, true);
    const updatedDrafts = await service.listDrafts();
    expect(updatedDrafts).toHaveLength(0);
  });
});
