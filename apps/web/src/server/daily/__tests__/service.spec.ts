import { describe, it, expect, beforeEach } from "vitest";
import { dailyGameList } from "@merky/games/daily";
import { resetDailyStore } from "../store";
import { MemoryDailyStore } from "../store/memory";
import * as service from "../service";
import { ServiceError } from "../../errors";
import { currentPuzzleDate } from "../timezone";

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

describe("factCheck.status contract", () => {
  const today = currentPuzzleDate();
  const shift = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const relayPayload = {
    startWord: "STONE",
    endWord: "WHALE",
    wordBank: [
      "ECHO", "OASIS", "SNOW", "WHALE", "EAGLE", "ORBIT",
      "SPARK", "WAGON", "TIGER", "NOVEL", "ERASE", "WHEAT",
    ],
  };

  beforeEach(() => {
    resetDailyStore(new MemoryDailyStore());
  });

  it('"passed" queues and "needs_review" drafts', async () => {
    await expect(
      service.submitPack("relay", shift(3), relayPayload, [], { status: "passed" })
    ).resolves.toMatchObject({ status: "queued" });

    resetDailyStore(new MemoryDailyStore());
    await expect(
      service.submitPack("relay", shift(3), relayPayload, [], { status: "needs_review" })
    ).resolves.toMatchObject({ status: "draft" });
  });

  it("omitting factCheck entirely is legal and drafts", async () => {
    // "I did not fact-check" is a real answer; only a wrong *value* is a typo.
    await expect(
      service.submitPack("relay", shift(3), relayPayload, [])
    ).resolves.toMatchObject({ status: "draft" });
  });

  // These are the exact values live fill runs sent. Each one silently drafted
  // a pack that was eligible to queue, which is how Nutshell came within one
  // approval of serving nothing.
  it.each(["not_applicable", "unreviewed", "PASSED", "pass", "", null])(
    "rejects %j rather than silently drafting",
    async (bad) => {
      await expect(
        service.submitPack("relay", shift(3), relayPayload, [], { status: bad })
      ).rejects.toMatchObject({ code: "invalid_fact_check_status", status: 400 });
    }
  );

  it("names both valid values in the error, so the fix is obvious", async () => {
    await expect(
      service.submitPack("relay", shift(3), relayPayload, [], { status: "not_applicable" })
    ).rejects.toThrow(/"passed".*"needs_review"/);
  });

  it("nothing is written when the status is rejected", async () => {
    const date = shift(3);
    await expect(
      service.submitPack("relay", date, relayPayload, [], { status: "unreviewed" })
    ).rejects.toThrow();
    expect(await service.listDrafts("relay")).toHaveLength(0);
  });
});

describe("unqueuePuzzle", () => {
  /** Dates are derived from the real rollover so these never rot. */
  const today = currentPuzzleDate();
  const shift = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const future = shift(5);

  /** Verified solvable: STONE→ECHO→OASIS→SNOW→WHALE. */
  const relayPayload = {
    startWord: "STONE",
    endWord: "WHALE",
    wordBank: [
      "ECHO", "OASIS", "SNOW", "WHALE", "EAGLE", "ORBIT",
      "SPARK", "WAGON", "TIGER", "NOVEL", "ERASE", "WHEAT",
    ],
  };

  let store: MemoryDailyStore;
  beforeEach(() => {
    store = new MemoryDailyStore();
    resetDailyStore(store);
  });

  const seed = (puzzleDate: string, gameId = "relay") =>
    store.insertPack({ gameId, puzzleDate, payload: relayPayload, sourceRefs: [] }, "queued", null);

  it("deletes a future puzzle and frees its date", async () => {
    await seed(future);
    expect(await store.getPuzzle("relay", future)).not.toBeNull();

    const res = await service.unqueuePuzzle("relay", future);

    expect(res).toMatchObject({ ok: true, gameId: "relay", puzzleDate: future, deleted: true });
    expect(await store.getPuzzle("relay", future)).toBeNull();
  });

  it("refuses today's puzzle — it is live", async () => {
    await seed(today);
    await expect(service.unqueuePuzzle("relay", today)).rejects.toMatchObject({
      code: "date_not_future",
      status: 400,
    });
    expect(await store.getPuzzle("relay", today)).not.toBeNull();
  });

  it("refuses a past puzzle — it is somebody's history", async () => {
    const past = shift(-3);
    await seed(past);
    await expect(service.unqueuePuzzle("relay", past)).rejects.toMatchObject({
      code: "date_not_future",
    });
    expect(await store.getPuzzle("relay", past)).not.toBeNull();
  });

  it("refuses to delete a puzzle that has attempts against it", async () => {
    await seed(future);
    const puzzle = (await store.getPuzzle("relay", future))!;
    await store.upsertAttempt({
      id: "attempt-1",
      device_id: "device-1",
      puzzle_id: puzzle.id,
      game_id: "relay",
      puzzle_date: future,
      phase: "playing",
      public_state: {},
      secret_state: {},
      version: 1,
      status: "in_progress",
      on_time: true,
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_ms: null,
      score: null,
      share_text: null,
      updated_at: new Date().toISOString(),
    });

    await expect(service.unqueuePuzzle("relay", future)).rejects.toMatchObject({
      code: "puzzle_has_attempts",
      status: 409,
    });
    // The cascade never fired, so the puzzle and its attempt both survive.
    expect(await store.getPuzzle("relay", future)).not.toBeNull();
    expect(await store.countAttemptsForPuzzle(puzzle.id)).toBe(1);
  });

  it("404s when no puzzle is queued for that date", async () => {
    await expect(service.unqueuePuzzle("relay", future)).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });

  it("rejects an unknown game and a malformed date", async () => {
    await expect(service.unqueuePuzzle("not-a-game", future)).rejects.toMatchObject({
      code: "game_unknown",
    });
    await expect(service.unqueuePuzzle("relay", "07-2026-30")).rejects.toMatchObject({
      code: "invalid_request",
    });
  });

  it("releases the content fingerprint, so the same puzzle can be built again", async () => {
    const laterDate = shift(6);
    await service.submitPack("relay", future, relayPayload, [], { status: "passed" });

    // While it is queued, the same content anywhere else is a duplicate.
    await expect(
      service.submitPack("relay", laterDate, relayPayload, [], { status: "passed" })
    ).rejects.toMatchObject({ code: "duplicate_puzzle", status: 409 });

    await service.unqueuePuzzle("relay", future);

    // Once removed it stops counting as used — this is what makes a purge-then-
    // refill run possible without every pack colliding with what it replaced.
    await expect(
      service.submitPack("relay", laterDate, relayPayload, [], { status: "passed" })
    ).resolves.toMatchObject({ ok: true, status: "queued" });
  });
});
