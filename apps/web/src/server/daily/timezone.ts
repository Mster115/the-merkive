/**
 * Local-midnight rollover mechanism: puzzle selection and the streak same-day
 * check both key off `localDateFor(device.timezone)`, NOT server UTC time.
 * Accepted edge case: a device that changes timezone mid-day can see an odd jump
 * — not solved here.
 */

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
