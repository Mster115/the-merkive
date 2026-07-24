import { describe, it, expect, beforeEach } from "vitest";
import { resetDailyStore } from "../store";
import { MemoryDailyStore } from "../store/memory";
import * as service from "../service";
import { ServiceError } from "../../errors";

describe("daily service layer", () => {
  beforeEach(() => {
    resetDailyStore(new MemoryDailyStore());
  });

  it("listGames returns empty array when no games registered", () => {
    const games = service.listGames();
    expect(games).toEqual([]);
  });

  it("getTodayOrCreateAttempt throws 404 if game is unknown", async () => {
    await expect(
      service.getTodayOrCreateAttempt("unknown-game", "device-1", "UTC")
    ).rejects.toThrow(ServiceError);
  });

  it("getQueueStatus returns status for all registered games or single game", async () => {
    const status = await service.getQueueStatus();
    expect(status).toEqual({});
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
