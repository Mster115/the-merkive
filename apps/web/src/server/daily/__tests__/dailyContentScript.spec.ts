import { describe, it, expect } from "vitest";
import {
  addDays,
  firstFreeDate,
  planDates,
  preflight,
  queueRisk,
  todayUtc,
} from "../../../../../../scripts/daily-content.mjs";

/**
 * The pipeline CLI exists to make three API hazards unreachable rather than
 * merely documented: writing over a live puzzle, deriving the next free date
 * wrongly from a count, and colliding with a draft that `queue-status` cannot
 * see. Those rules are only worth anything if they are pinned.
 */
describe("daily-content queue arithmetic", () => {
  const today = "2026-07-25";

  it("uses the same UTC date the server compares against", () => {
    expect(todayUtc(new Date("2026-07-25T23:30:00Z"))).toBe("2026-07-25");
    // Local time would already read the 26th in Sydney here; the server would not.
    expect(todayUtc(new Date("2026-07-25T13:59:00Z"))).toBe("2026-07-25");
  });

  it("never targets today, however empty the queue is", () => {
    expect(firstFreeDate(0, today)).toBe("2026-07-26");
    expect(firstFreeDate(1, today)).toBe("2026-07-26");
  });

  it("puts the next puzzle immediately after the queued window, leaving no hole", () => {
    // queuedFutureDays counts dates >= today, so n=3 fills 25th, 26th, 27th.
    expect(firstFreeDate(3, today)).toBe("2026-07-28");
    expect(firstFreeDate(5, today)).toBe("2026-07-30");
  });

  it("plans only as many days as the lookahead is short, capped per run", () => {
    expect(planDates(2, 5, today)).toEqual(["2026-07-27", "2026-07-28", "2026-07-29"]);
    expect(planDates(4, 5, today)).toEqual(["2026-07-29"]);
    expect(planDates(5, 5, today)).toEqual([]);
    expect(planDates(0, 30, today)).toHaveLength(3); // maxPerRun
  });

  it("treats a one-day queue as at risk, because devices roll over before UTC", () => {
    // A device's today is localDateFor(device.timezone). UTC+14 asks for
    // tomorrow's puzzle 14 hours before the server's UTC date agrees.
    expect(queueRisk(0)).toMatch(/EMPTY/);
    expect(queueRisk(1)).toMatch(/east of UTC/);
    expect(queueRisk(2)).toBeNull();
  });

  it("does arithmetic across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(firstFreeDate(2, "2026-12-31")).toBe("2027-01-02");
  });
});

describe("daily-content preflight", () => {
  it("catches a Nexus pack with no citations or a short grid", () => {
    const { problems } = preflight({
      gameId: "nexus",
      puzzleDate: "2026-07-27",
      sourceRefs: [],
      payload: { rowLabels: ["a", "b", "c"], colLabels: ["d", "e", "f"], cells: [] },
    });
    expect(problems).toContainEqual(expect.stringContaining("at least one sourceRef"));
    expect(problems).toContainEqual(expect.stringContaining("exactly 9 entries"));
  });

  it("catches a Nexus question that gives away another cell's answer", () => {
    // Found by running the pipeline for real: "named after the Titans" handed
    // over the TITAN cell, and "when a volcano's magma reservoir empties" handed
    // over MAGMA. Questions ship in publicState from the first render.
    const cells = [
      { row: 0, col: 0, question: "Which element is named after the Titans?", answer: "Titanium", acceptableAnswers: ["Ti"] },
      { row: 0, col: 1, question: "Saturn's largest moon?", answer: "Titan", acceptableAnswers: ["Titan"] },
      { row: 0, col: 2, question: "Sixth element?", answer: "Carbon", acceptableAnswers: ["C"] },
      { row: 1, col: 0, question: "Fourth planet?", answer: "Mars", acceptableAnswers: ["Mars"] },
      { row: 1, col: 1, question: "Long ocean waves?", answer: "Tsunami", acceptableAnswers: ["Tsunami"] },
      { row: 1, col: 2, question: "Jupiter moon?", answer: "Callisto", acceptableAnswers: ["Callisto"] },
      { row: 2, col: 0, question: "Molten rock below ground?", answer: "Magma", acceptableAnswers: ["Magma"] },
      { row: 2, col: 1, question: "Twelfth element?", answer: "Magnesium", acceptableAnswers: ["Mg"] },
      { row: 2, col: 2, question: "Basin left when a magma reservoir collapses?", answer: "Caldera", acceptableAnswers: ["Caldera"] },
    ];
    const { problems } = preflight({
      gameId: "nexus",
      puzzleDate: "2026-07-27",
      sourceRefs: [{ url: "https://example.gov/x", title: "X" }],
      payload: { rowLabels: ["a", "b", "c"], colLabels: ["d", "e", "f"], cells },
    });
    expect(problems).toContainEqual(expect.stringContaining('"Titan"'));
    expect(problems).toContainEqual(expect.stringContaining('"Magma"'));
  });

  it("names the Nutshell candidates the solver would silently drop", () => {
    const { problems } = preflight({
      gameId: "nutshell",
      puzzleDate: "2026-07-27",
      payload: { candidates: [{ word: "WALL-E", clue: "Robot" }, { word: "OK", clue: "Fine" }] },
    });
    expect(problems).toContainEqual(expect.stringContaining("WALL-E"));
    expect(problems).toContainEqual(expect.stringContaining("OK"));
  });

  it("flags a Relay bank whose shortcut is shorter than the validator's par", () => {
    // OTTER → RIVER links directly, so parMoves would be recorded from the
    // long route while every player takes the one-move path.
    const { warnings } = preflight({
      gameId: "relay",
      puzzleDate: "2026-07-27",
      payload: {
        startWord: "OTTER",
        endWord: "RIVER",
        wordBank: ["RUST", "TIDE", "ECHO", "OASIS", "SLATE", "RIVER"],
      },
    });
    expect(warnings.join("\n")).toContain("shortest chain is 1 moves");
  });

  it("passes a well-formed Relay pack", () => {
    const { problems } = preflight({
      gameId: "relay",
      puzzleDate: "2026-07-27",
      payload: {
        startWord: "STONE",
        endWord: "WHALE",
        wordBank: ["ECHO", "OASIS", "SNOW", "WHALE", "EAGLE", "ORBIT", "SPARK", "WAGON", "TIGER", "NOVEL", "ERASE", "WHEAT"],
      },
    });
    expect(problems).toEqual([]);
  });
});
