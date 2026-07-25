import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fillGrid,
  proposeGrid,
  loadWordList,
  loadPatterns,
  fingerprintPuzzle as mcpFingerprint,
  puzzleItems as mcpItems,
  handle,
  TOOLS,
} from "../../../../../../scripts/mcp/daily-mcp.mjs";
import { fingerprintPuzzle, puzzleItems, checkRepeat } from "../fingerprint";

/** Tool results always carry `content`; the union also covers protocol replies. */
type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };
const toolResult = (res: unknown) => res as ToolResult;
const toolJson = (res: unknown) => JSON.parse(toolResult(res).content[0]!.text);

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

/** Minimal stub of the admin API the MCP server talks to. */
function stubApi(routes: Record<string, unknown>) {
  vi.stubEnv("DAILY_PIPELINE_SECRET", "test-secret");
  globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("daily MCP grid construction", () => {
  it("fills a real interlock from the shipped word list", () => {
    const words = loadWordList();
    const patterns = (loadPatterns() as { id: string }[]).filter((p) => p.id.startsWith("corners"));
    expect(words.length).toBeGreaterThan(1000);
    expect(patterns[0]!.id).toBe("corners_3x3");
    expect(loadPatterns()[0]!.id).toBe("corners_3x3");

    const grid = fillGrid(words, patterns[0]!, new Set(), 4242);
    expect(grid).not.toBeNull();

    // Every crossing must agree, or the game's own solver will reject it.
    const letters = new Map<string, string>();
    for (const slot of [...grid!.across, ...grid!.down]) {
      expect(words).toContain(slot.answer);
      for (let k = 0; k < slot.length; k++) {
        const cell =
          slot.dir === "across" ? `${slot.row},${slot.col + k}` : `${slot.row + k},${slot.col}`;
        const existing = letters.get(cell);
        if (existing) expect(existing).toBe(slot.answer[k]);
        else letters.set(cell, slot.answer[k]);
      }
    }
    const used = [...grid!.across, ...grid!.down].map((s) => s.answer);
    expect(new Set(used).size).toBe(10);
  });

  it("keeps proposing fresh grids as earlier ones are used up", () => {
    // "Never the same puzzle twice" only holds if the word list can actually
    // supply new grids. A single fill is deterministic, so proposal has to
    // search seeds — and if the list ever shrinks below a usable supply, this
    // is what catches it.
    const words = loadWordList();
    const patterns = (loadPatterns() as { id: string }[]).filter((p) => p.id.startsWith("corners"));
    const used = new Set<string>();

    // Small budget: the real tool serves from the committed bank, and the
    // expensive search is an offline build step, not something a suite pays for.
    for (let i = 0; i < 3; i++) {
      const grid = proposeGrid(words, patterns, { usedFingerprints: used, budgetMs: 1_500, sample: 2 });
      expect(grid, `ran out of fresh grids after ${i}`).not.toBeNull();
      used.add(mcpFingerprint("nutshell", { across: grid!.across, down: grid!.down }));
    }
    expect(used.size).toBe(3);
  }, 60_000);

  it("honours avoided words", () => {
    const words = loadWordList();
    const patterns = (loadPatterns() as { id: string }[]).filter((p) => p.id.startsWith("corners"));
    const first = proposeGrid(words, patterns, { budgetMs: 1_500, sample: 2 });
    expect(first).not.toBeNull();
    const bannedWord = first!.across[2]!.answer as string;

    const second = proposeGrid(words, patterns, {
      avoidWords: new Set([bannedWord]),
      budgetMs: 1_500,
      sample: 2,
    });
    expect(second).not.toBeNull();
    const words2 = [...second!.across, ...second!.down].map((s: { answer: string }) => s.answer);
    expect(words2).not.toContain(bannedWord);
  }, 60_000);
});

describe("fingerprint parity between server and MCP", () => {
  // The MCP refuses repeats locally and the server refuses them again on
  // submit. If the two ever disagree, one of them is silently not enforcing
  // "never ship the same puzzle twice".
  const cases: { gameId: string; payload: unknown }[] = [
    {
      gameId: "nexus",
      payload: {
        cells: [
          { row: 0, col: 0, question: "q1", answer: "Magnesium" },
          { row: 0, col: 1, question: "q2", answer: " titan " },
          { row: 0, col: 2, question: "q3", answer: "Carbon" },
        ],
      },
    },
    {
      gameId: "nutshell",
      payload: {
        across: [{ answer: "GRASS" }, { answer: "LAP" }],
        down: [{ answer: "PLATE" }, { answer: "OIL" }],
      },
    },
    { gameId: "relay", payload: { startWord: "candle", endWord: "RIVER" } },
  ];

  for (const { gameId, payload } of cases) {
    it(`${gameId} fingerprints identically`, () => {
      expect(mcpFingerprint(gameId, payload)).toBe(fingerprintPuzzle(gameId, payload));
      expect(mcpItems(gameId, payload)).toEqual(puzzleItems(gameId, payload));
    });
  }

  it("is order- and case-insensitive, so a reshuffle is still the same puzzle", () => {
    const a = { cells: [{ answer: "Mars" }, { answer: "Titan" }] };
    const b = { cells: [{ answer: "TITAN" }, { answer: " mars" }] };
    expect(fingerprintPuzzle("nexus", a)).toBe(fingerprintPuzzle("nexus", b));
  });

  it("refuses a puzzle whose content already shipped", () => {
    const payload = { startWord: "CANDLE", endWord: "RIVER", wordBank: ["ECHO"] };
    const history = [
      {
        puzzleDate: "2026-01-04",
        fingerprint: fingerprintPuzzle("relay", { startWord: "CANDLE", endWord: "RIVER" }),
        itemTokens: [],
      },
    ];
    const res = checkRepeat("relay", payload, history);
    expect(res.ok).toBe(false);
    expect(res.duplicateOf).toBe("2026-01-04");
  });
});

describe("daily MCP protocol surface", () => {
  it("advertises its tools", async () => {
    const init = (await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })) as {
      serverInfo: { name: string };
    };
    expect(init.serverInfo.name).toBe("merkive-daily");

    const listed = (await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" })) as {
      tools: { name: string }[];
    };
    expect(listed.tools.map((t) => t.name).sort()).toEqual([
      "daily_brief",
      "daily_check",
      "daily_grid",
      "daily_history",
      "daily_plan",
      "daily_submit",
    ]);
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("plans from the server's real open dates, not from arithmetic", async () => {
    stubApi({
      "/api/admin/daily/queue-status": {
        relay: {
          queuedFutureDays: 2,
          lookaheadDays: 5,
          isSufficient: false,
          queuedDates: ["2026-07-25", "2026-07-27"],
          draftDates: ["2026-07-26"],
          openDates: ["2026-07-28", "2026-07-29", "2026-07-30"],
        },
      },
    });

    const res = await handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "daily_plan", arguments: { gameId: "relay" } },
    });
    const data = toolJson(res);
    // 2026-07-26 holds a draft, so it must not be offered as a target even
    // though a contiguous-queue guess would have picked it.
    expect(data.games.relay.nextTargets).toEqual(["2026-07-28", "2026-07-29", "2026-07-30"]);
  });

  it("blocks a submission for a date that already holds a draft", async () => {
    stubApi({
      "/api/admin/daily/queue-status": {
        relay: { queuedFutureDays: 1, lookaheadDays: 3, queuedDates: [], draftDates: ["2099-01-02"], openDates: [] },
      },
      "/api/admin/daily/history": { digests: [] },
    });

    const res = await handle({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "daily_check",
        arguments: {
          gameId: "relay",
          puzzleDate: "2099-01-02",
          payload: {
            startWord: "STONE",
            endWord: "WHALE",
            wordBank: ["ECHO", "OASIS", "SNOW", "WHALE", "EAGLE", "ORBIT", "SPARK", "WAGON", "TIGER", "NOVEL", "ERASE", "WHEAT"],
          },
        },
      },
    });
    const data = toolJson(res);
    expect(data.wouldSubmit).toBe(false);
    expect(data.blockers.join(" ")).toContain("draft awaiting review");
  });

  it("blocks a repeat puzzle before it ever reaches the API", async () => {
    const payload = { startWord: "STONE", endWord: "WHALE", wordBank: ["WHALE", "ECHO", "OASIS", "SNOW"] };
    stubApi({
      "/api/admin/daily/queue-status": {
        relay: { queuedFutureDays: 3, lookaheadDays: 3, queuedDates: [], draftDates: [], openDates: [] },
      },
      "/api/admin/daily/history": {
        digests: [
          {
            puzzleDate: "2026-02-02",
            fingerprint: fingerprintPuzzle("relay", payload),
            itemTokens: [],
          },
        ],
      },
    });

    const res = await handle({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "daily_check", arguments: { gameId: "relay", puzzleDate: "2099-03-03", payload } },
    });
    const data = toolJson(res);
    expect(data.wouldSubmit).toBe(false);
    expect(data.blockers.join(" ")).toContain("never repeated");
  });

  it("never lets the pipeline secret reach a tool result", async () => {
    stubApi({ "/api/admin/daily/queue-status": { relay: { queuedFutureDays: 0, lookaheadDays: 3, openDates: [] } } });
    const res = await handle({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "daily_plan", arguments: { gameId: "relay" } },
    });
    expect(JSON.stringify(res)).not.toContain("test-secret");
  });
});
