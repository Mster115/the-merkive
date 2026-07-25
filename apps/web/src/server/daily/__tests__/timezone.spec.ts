import { describe, it, expect } from "vitest";
import {
  localDateFor,
  msUntilLocalRollover,
  resolveTimezone,
  currentPuzzleDate,
  DAILY_TIMEZONE,
} from "../timezone";

const HOUR = 3_600_000;

describe("the global Eastern reset", () => {
  it("resolves every request to the daily timezone, whatever the device reports", () => {
    // The x-mb-tz header used to choose the puzzle day; now the flip is one
    // global moment. If this ever regresses, players in different zones drift
    // onto different puzzles again.
    for (const claimed of ["Asia/Tokyo", "Pacific/Kiritimati", "UTC", "Not/AZone", null]) {
      const headers: Record<string, string> = claimed === null ? {} : { "x-mb-tz": claimed };
      expect(resolveTimezone(new Request("https://x.test", { headers }))).toBe(DAILY_TIMEZONE);
    }
    expect(DAILY_TIMEZONE).toBe("America/New_York");
  });

  it("advances the puzzle date exactly at midnight Eastern", () => {
    // 04:00 UTC is the flip during EDT.
    expect(currentPuzzleDate(Date.parse("2026-07-26T03:59:59Z"))).toBe("2026-07-25");
    expect(currentPuzzleDate(Date.parse("2026-07-26T04:00:01Z"))).toBe("2026-07-26");
  });
});

describe("msUntilLocalRollover", () => {
  it("counts down to the next local midnight, not UTC midnight", () => {
    // 2026-07-24T23:00:00Z. In UTC that is 1h to rollover; in New York it is
    // 19:00 the same day, so 5h. Getting this wrong rolls puzzles at the wrong
    // moment for everyone outside UTC.
    const now = Date.parse("2026-07-24T23:00:00Z");
    expect(msUntilLocalRollover("UTC", now)).toBe(HOUR);
    expect(msUntilLocalRollover("America/New_York", now)).toBe(5 * HOUR);
  });

  it("lands exactly on the instant the local date changes", () => {
    const tz = "Europe/Berlin";
    const now = Date.parse("2026-07-24T09:13:27Z");
    const ms = msUntilLocalRollover(tz, now);

    const justBefore = localDateFor(tz, now + ms - 1000);
    const atRollover = localDateFor(tz, now + ms);
    expect(justBefore).toBe(localDateFor(tz, now));
    expect(atRollover).not.toBe(justBefore);
  });

  it("handles a DST transition without drifting an hour", () => {
    // US DST ends 2026-11-01, so 2026-10-31 local has a 25-hour day.
    const tz = "America/New_York";
    const now = Date.parse("2026-11-01T02:30:00Z"); // 2026-10-31 22:30 EDT
    const ms = msUntilLocalRollover(tz, now);

    expect(localDateFor(tz, now + ms)).not.toBe(localDateFor(tz, now));
    expect(localDateFor(tz, now + ms - 1000)).toBe(localDateFor(tz, now));
  });

  it("never returns a negative countdown", () => {
    expect(msUntilLocalRollover("UTC", Date.parse("2026-07-24T00:00:00Z"))).toBeGreaterThan(0);
    expect(msUntilLocalRollover("Not/AZone", Date.now())).toBeGreaterThanOrEqual(0);
  });
});
