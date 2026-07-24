import { describe, it, expect } from "vitest";
import { computeStreaks } from "../streaks";

describe("computeStreaks", () => {
  const today = "2026-07-24";
  const yesterday = "2026-07-23";

  it("handles no rows", () => {
    const res = computeStreaks([], today);
    expect(res).toEqual({ current: 0, longest: 0, totalSolved: 0 });
  });

  it("handles an unbroken streak ending today", () => {
    const rows = [
      { puzzleDate: "2026-07-22", status: "solved", onTime: true },
      { puzzleDate: "2026-07-23", status: "solved", onTime: true },
      { puzzleDate: "2026-07-24", status: "solved", onTime: true },
    ];
    const res = computeStreaks(rows, today);
    expect(res).toEqual({ current: 3, longest: 3, totalSolved: 3 });
  });

  it("handles an unbroken streak ending yesterday (today not played yet)", () => {
    const rows = [
      { puzzleDate: "2026-07-22", status: "solved", onTime: true },
      { puzzleDate: "2026-07-23", status: "solved", onTime: true },
    ];
    const res = computeStreaks(rows, today);
    expect(res).toEqual({ current: 2, longest: 2, totalSolved: 2 });
  });

  it("resets current to 0 on a broken streak while preserving longest", () => {
    const rows = [
      { puzzleDate: "2026-07-20", status: "solved", onTime: true },
      { puzzleDate: "2026-07-21", status: "solved", onTime: true },
      { puzzleDate: "2026-07-22", status: "failed", onTime: false },
      // 2026-07-23 missing
    ];
    const res = computeStreaks(rows, today);
    expect(res).toEqual({ current: 0, longest: 2, totalSolved: 2 });
  });

  it("handles solving an old archive date that does not patch a gap in current streak", () => {
    const rows = [
      { puzzleDate: "2026-07-10", status: "solved", onTime: true },
      { puzzleDate: "2026-07-11", status: "solved", onTime: true },
      { puzzleDate: "2026-07-24", status: "solved", onTime: true },
    ];
    const res = computeStreaks(rows, today);
    expect(res).toEqual({ current: 1, longest: 2, totalSolved: 3 });
  });

  it("only counts status === 'solved' towards streaks", () => {
    const rows = [
      { puzzleDate: "2026-07-23", status: "failed", onTime: false },
      { puzzleDate: "2026-07-24", status: "in_progress", onTime: false },
    ];
    const res = computeStreaks(rows, today);
    expect(res).toEqual({ current: 0, longest: 0, totalSolved: 0 });
  });

  it("a same-day-adjacent archive catch-up does NOT patch a contiguous streak gap (strict rule)", () => {
    // Player solved day 20-21 on time, missed day 22 in real time, then went
    // back and solved day 22's archive puzzle well after the fact. Day 23 was
    // never played at all, and today (24) hasn't been played yet either.
    const rows = [
      { puzzleDate: "2026-07-20", status: "solved", onTime: true },
      { puzzleDate: "2026-07-21", status: "solved", onTime: true },
      { puzzleDate: "2026-07-22", status: "solved", onTime: false }, // archive catch-up
    ];
    const res = computeStreaks(rows, today);
    // Without the onTime filter this would wrongly compute longest=3 (20-22
    // read as contiguous) — the archive solve must be excluded from the
    // streak-eligible set even though it's chronologically adjacent.
    expect(res).toEqual({ current: 0, longest: 2, totalSolved: 3 });
  });
});
