/**
 * Local-midnight rollover mechanism: puzzle selection and the streak same-day
 * check both key off `localDateFor(device.timezone)`, NOT server UTC time.
 * Accepted edge case: a device that changes timezone mid-day can see an odd jump
 * — not solved here.
 */

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

export function resolveTimezone(req: Request): string {
  const tz = req.headers.get("x-mb-tz");
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
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
