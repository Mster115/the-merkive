/**
 * Ensures the mb_device cookie exists before any daily-games fetch fires.
 * Several components (DailyPlayShell, HistoryView, ArchiveList) mount and
 * fetch concurrently on a visitor's first request; without this shared
 * in-flight promise, each would independently mint its own device id via
 * resolveDeviceId(), fragmenting one visitor across multiple device rows.
 * Module-level cache means every caller within the same page load awaits
 * the same single POST /api/daily/device request.
 */
let inFlight: Promise<void> | null = null;

export function ensureDailyDevice(): Promise<void> {
  if (!inFlight) {
    inFlight = fetch("/api/daily/device", { method: "POST" })
      .catch(() => undefined)
      .then(() => undefined);
  }
  return inFlight;
}
