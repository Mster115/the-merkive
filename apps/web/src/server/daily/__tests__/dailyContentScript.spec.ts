import { describe, it, expect } from "vitest";
import {
  addDays,
  firstFreeDate,
  planDates,
  preflight,
  queueRisk,
  currentPuzzleDate,
} from "../../../../../../scripts/daily-content.mjs";

/**
 * The pipeline CLI exists to make three API hazards unreachable rather than
 * merely documented: writing over a live puzzle, deriving the next free date
 * wrongly from a count, and colliding with a draft that `queue-status` cannot
 * see. Those rules are only worth anything if they are pinned.
 */
describe("daily-content queue arithmetic", () => {
  const today = "2026-07-25";

  it("uses the Eastern reset date the server compares against", () => {
    expect(currentPuzzleDate(new Date("2026-07-25T23:30:00Z"))).toBe("2026-07-25");
    // 02:00 UTC is already the 26th in UTC — but still the evening of the 25th
    // in New York, and the games flip at midnight Eastern, not midnight UTC.
    expect(currentPuzzleDate(new Date("2026-07-26T02:00:00Z"))).toBe("2026-07-25");
    // And the moment New York's clock passes midnight, the date advances
    // (04:00 UTC during EDT).
    expect(currentPuzzleDate(new Date("2026-07-26T04:00:01Z"))).toBe("2026-07-26");
    // DST: in January the flip is at 05:00 UTC.
    expect(currentPuzzleDate(new Date("2026-01-10T04:59:00Z"))).toBe("2026-01-09");
    expect(currentPuzzleDate(new Date("2026-01-10T05:00:01Z"))).toBe("2026-01-10");
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

  it("treats a one-day queue as at risk — the global flip empties it at midnight Eastern", () => {
    expect(queueRisk(0)).toMatch(/EMPTY/);
    expect(queueRisk(1)).toMatch(/midnight US Eastern/);
    expect(queueRisk(2)).toBeNull();
  });

  it("does arithmetic across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(firstFreeDate(2, "2026-12-31")).toBe("2027-01-02");
  });
});

describe("daily-content preflight — Nutshell layouts", () => {
  const pool = (words: string[]) => ({
    gameId: "nutshell",
    puzzleDate: "2099-01-01",
    payload: { candidates: words.map((word) => ({ word, clue: `clue for ${word}` })) },
    sourceRefs: [],
  });

  it("accepts a corner-layout pool (eight 3s and two 5s)", () => {
    // This is the shape `daily_grid` returns most often and the first shape
    // the solver tries. Preflight used to demand the staircase distribution
    // and rejected every one of them — the pipeline blocking its own grids.
    const { problems } = preflight(
      pool(["AMP", "DOE", "COO", "END", "ADS", "MOP", "ION", "NOD", "SPAIN", "PEACE"])
    );
    expect(problems).toEqual([]);
  });

  it("still accepts a staircase pool (two 3s, four 4s, four 5s)", () => {
    const { problems } = preflight(
      pool(["ARC", "SHY", "ROLE", "CREW", "MASS", "INCH", "MINOR", "ANGLE", "SCREW", "ANGRY"])
    );
    expect(problems).toEqual([]);
  });

  it("accepts a four_corners_blocked pool (four 3s and six 5s)", () => {
    // This shape (patterns.ts's four_corners_blocked) is distinct from the
    // eight-3s corner layout above and was rejected by a stale MCP server
    // process still running preflight's old hardcoded staircase check —
    // 2026-07-26 incident. Pinned here so a future regression in either the
    // check or the pattern library shows up as a failing test, not a live
    // daily_check rejection.
    const { problems } = preflight(
      pool(["NEW", "SOLID", "IVORY", "TEPEE", "LED", "NOVEL", "ELOPE", "WIRED", "SIT", "DYE"])
    );
    expect(problems).toEqual([]);
  });

  it("rejects a pool that fills no layout at all", () => {
    const { problems } = preflight(
      pool(["CAT", "DOG", "BAT", "RAT", "HAT", "MAT", "PAT", "SAT", "VAT", "OAT"])
    );
    expect(problems.join(" ")).toMatch(/fills no layout/);
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

  it("flags a Nexus question about one film in a series that names no year or position", () => {
    // Reported live: a player answered "The Lord of the Rings" for a key of
    // "The Return of the King". The grader cannot accept the franchise — it
    // would equally answer the other two films — so the fix is upstream, in a
    // question that says which installment it means.
    const seriesCell = (question: string) => ({
      row: 0,
      col: 0,
      question,
      answer: "The Return of the King",
      acceptableAnswers: [],
    });
    const filler = Array.from({ length: 8 }, (_, i) => ({
      row: Math.floor((i + 1) / 3),
      col: (i + 1) % 3,
      question: "Fourth planet?",
      answer: "Mars",
      acceptableAnswers: [],
    }));
    const run = (question: string) =>
      preflight({
        gameId: "nexus",
        puzzleDate: "2026-07-27",
        sourceRefs: [{ url: "https://example.gov/x", title: "X" }],
        payload: {
          rowLabels: ["a", "b", "c"],
          colLabels: ["d", "e", "f"],
          cells: [seriesCell(question), ...filler],
        },
      }).warnings.filter((w: string) => w.includes("under-specified"));

    expect(run("Which film features Frodo and Sam?")).toHaveLength(1);
    // Either kind of marker is enough to pin it down.
    expect(run("Which 2003 film completed the Middle-earth trilogy?")).toEqual([]);
    expect(run("Which third film in the trilogy won Best Picture?")).toEqual([]);
  });

  it("catches a Nexus question that identifies its own answer", () => {
    // Reported live on 2026-07-31: "Which 2024 Summer Games became the first in
    // Olympic history to field an equal number of male and female athletes?"
    // There is exactly one 2024 Summer Games, so the question names the thing it
    // is asking for and the player is left guessing which label the key uses.
    // The same grid asked "…competing as B-Girl Ami…" for an answer of Ami
    // Yuasa. Player's words: "I would never have guessed that's what they were
    // looking for."
    const filler = Array.from({ length: 7 }, (_, i) => ({
      row: Math.floor((i + 2) / 3),
      col: (i + 2) % 3,
      question: "Fourth planet?",
      answer: "Mars",
      acceptableAnswers: [],
    }));
    const run = (cells: unknown[]) =>
      preflight({
        gameId: "nexus",
        puzzleDate: "2026-07-31",
        sourceRefs: [{ url: "https://example.gov/x", title: "X" }],
        payload: { rowLabels: ["a", "b", "c"], colLabels: ["d", "e", "f"], cells },
      }).problems.filter((p: string) => p.includes("its own answer"));

    const broken = run([
      {
        row: 0,
        col: 0,
        question:
          "Which 2024 Summer Games became the first in Olympic history to field an equal number of male and female athletes?",
        answer: "Paris 2024",
        acceptableAnswers: [],
      },
      {
        row: 0,
        col: 1,
        question:
          "Which Japanese breaker, competing as B-Girl Ami, won the first-ever Olympic gold medal in breaking?",
        answer: "Ami Yuasa",
        acceptableAnswers: [],
      },
      ...filler,
    ]);
    expect(broken).toHaveLength(2);
    expect(broken.join(" ")).toContain('"2024"');
    expect(broken.join(" ")).toContain('"ami"');

    // Asking for something the sentence does not already contain is clean.
    expect(
      run([
        {
          row: 0,
          col: 0,
          question:
            "Which host city staged the first Olympics with equal numbers of male and female athletes?",
          answer: "Paris",
          acceptableAnswers: [],
        },
        {
          row: 0,
          col: 1,
          question: "Which Japanese athlete won the first Olympic gold awarded in breaking?",
          answer: "Ami Yuasa",
          acceptableAnswers: [],
        },
        ...filler,
      ])
    ).toEqual([]);
  });

  it("matches whole words only, so an answer buried in a longer word is not a leak", () => {
    // "Ami" inside "dynamic" is not the answer showing through, and a check
    // that fired there would train the pipeline to ignore it.
    const { problems } = preflight({
      gameId: "nexus",
      puzzleDate: "2026-07-31",
      sourceRefs: [{ url: "https://example.gov/x", title: "X" }],
      payload: {
        rowLabels: ["a", "b", "c"],
        colLabels: ["d", "e", "f"],
        cells: [
          {
            row: 0,
            col: 0,
            question: "Which dynamic duo headlined the ceremony?",
            answer: "Ami Yuasa",
            acceptableAnswers: [],
          },
          ...Array.from({ length: 8 }, (_, i) => ({
            row: Math.floor((i + 1) / 3),
            col: (i + 1) % 3,
            question: "Fourth planet?",
            answer: "Mars",
            acceptableAnswers: [],
          })),
        ],
      },
    });
    expect(problems.filter((p: string) => p.includes("its own answer"))).toEqual([]);
  });

  it("warns when an edition-style answer could be written several ways", () => {
    const { warnings } = preflight({
      gameId: "nexus",
      puzzleDate: "2026-07-31",
      sourceRefs: [{ url: "https://example.gov/x", title: "X" }],
      payload: {
        rowLabels: ["a", "b", "c"],
        colLabels: ["d", "e", "f"],
        cells: [
          {
            row: 0,
            col: 0,
            question: "Which host city staged the Games where breaking debuted?",
            answer: "Paris 2024",
            acceptableAnswers: ["Paris"],
          },
          ...Array.from({ length: 8 }, (_, i) => ({
            row: Math.floor((i + 1) / 3),
            col: (i + 1) % 3,
            question: "Fourth planet?",
            answer: "Mars",
            acceptableAnswers: ["Mars"],
          })),
        ],
      },
    });
    expect(warnings.join(" ")).toContain("several ways");
  });

  it("does not flag a Nexus answer that no franchise name could stand in for", () => {
    const cells = [
      { row: 0, col: 0, question: "Which physicist was born in Ulm?", answer: "Albert Einstein", acceptableAnswers: [] },
      { row: 0, col: 1, question: "Which film star made The Great Dictator?", answer: "Chaplin", acceptableAnswers: [] },
      ...Array.from({ length: 7 }, (_, i) => ({
        row: Math.floor((i + 2) / 3),
        col: (i + 2) % 3,
        question: "Fourth planet?",
        answer: "Mars",
        acceptableAnswers: [],
      })),
    ];
    const { warnings } = preflight({
      gameId: "nexus",
      puzzleDate: "2026-07-27",
      sourceRefs: [{ url: "https://example.gov/x", title: "X" }],
      payload: { rowLabels: ["a", "b", "c"], colLabels: ["d", "e", "f"], cells },
    });
    expect(warnings.filter((w: string) => w.includes("under-specified"))).toEqual([]);
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
