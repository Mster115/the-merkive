/**
 * Daily rollover mechanism.
 *
 * The daily games flip once, globally, at midnight US Eastern
 * (`DAILY_TIMEZONE`): puzzle selection, the archive cutoff, `on_time`, and the
 * streak same-day check all key off the Eastern calendar date, and the
 * countdown runs to the next Eastern midnight. Every player worldwide sees the
 * same puzzle at the same moment, and content deadlines are one wall-clock
 * time instead of a 26-hour smear of device-local midnights.
 *
 * History: rollover used to be per-device local midnight, keyed off the
 * `x-mb-tz` header. The generic helpers below still take a timezone argument
 * (and are tested against several) so the reset zone stays a one-line
 * decision; `resolveTimezone` is where the fixed zone is imposed.
 */

/**
 * The one timezone the daily games reset in. Midnight here is the flip for
 * everyone. DST is intentional: the flip tracks US Eastern wall clocks.
 */
export const DAILY_TIMEZONE = "America/New_York";

/**
 * Offset in ms that `timezone` is ahead of UTC at a given instant. Derived by
 * formatting the instant as local wall-clock and reading it back as if it were
 * UTC, so it needs no timezone database of its own and follows DST.
 */
function tzOffsetMs(timezone: string, atMs: number): number {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(atMs));

  // Fall back to UTC on an unknown zone, matching localDateFor rather than
  // throwing out of a helper its sibling handles gracefully.
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timezone);
  } catch {
    parts = format("UTC");
  }

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Intl can render midnight as hour 24 in some locales/zones.
  const asIfUtc = Date.UTC(at("year"), at("month") - 1, at("day"), at("hour") % 24, at("minute"), at("second"));
  return asIfUtc - Math.floor(atMs / 1000) * 1000;
}

/**
 * Milliseconds until the next local-midnight rollover — i.e. until today's
 * puzzles are replaced. Drives the "next puzzles in …" countdown.
 */
export function msUntilLocalRollover(timezone: string, nowMs: number = Date.now()): number {
  const [y, m, d] = localDateFor(timezone, nowMs).split("-").map(Number);
  if (!y || !m || !d) return 0;

  // Wall-clock midnight that begins tomorrow, expressed as if it were UTC.
  const tomorrowWallUtc = Date.UTC(y, m - 1, d + 1);

  // Convert that wall-clock to a real instant. The offset can itself change
  // across the boundary (DST), so resolve with the offset at the candidate
  // instant rather than the offset right now.
  const firstPass = tomorrowWallUtc - tzOffsetMs(timezone, nowMs);
  const rollover = tomorrowWallUtc - tzOffsetMs(timezone, firstPass);

  return Math.max(0, rollover - nowMs);
}

/**
 * The timezone daily requests operate in — always `DAILY_TIMEZONE`.
 *
 * The request is still accepted so call sites keep one shape, and the client
 * still sends `x-mb-tz`, but the header no longer chooses the puzzle day: the
 * flip is global. (Stored per-device zones from the local-midnight era are
 * converged by `effectiveTimezone`, which never lets a device's date rewind.)
 */
export function resolveTimezone(_req: Request): string {
  return DAILY_TIMEZONE;
}

/** Today's puzzle date — the current calendar date in `DAILY_TIMEZONE`. */
export function currentPuzzleDate(nowMs: number = Date.now()): string {
  return localDateFor(DAILY_TIMEZONE, nowMs);
}

export function localDateFor(timezone: string, nowMs: number = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(nowMs));
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(nowMs));
  }
}
