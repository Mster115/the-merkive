import { describe, it, expect } from "vitest";
import { localDateFor, msUntilLocalRollover } from "../timezone";

const HOUR = 3_600_000;

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
