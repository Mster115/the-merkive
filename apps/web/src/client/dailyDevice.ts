/**
 * Ensures the mb_device cookie exists before any daily-games fetch fires.
 *
 * Two races have to be closed, not one:
 *
 * 1. Within a page load, several components (DailyPlayShell, HistoryView,
 *    ArchiveList, the ticker) mount and fetch concurrently. The module-level
 *    promise makes them all await a single POST /api/daily/device.
 * 2. Across tabs, module state is per-tab, so two tabs opened together on a
 *    visitor's very first visit would each mint a device row and split that
 *    person's history in half. The Web Locks API is shared between same-origin
 *    tabs, so the bootstrap runs once per browser rather than once per tab.
 *
 * The id itself stays server-minted and httpOnly — localStorage records only
 * *that* a bootstrap happened, never the id. If the cookie is later cleared
 * while the marker survives, the next API call re-mints server-side and
 * re-sets the cookie, so a stale marker is self-healing.
 */
const BOOTSTRAP_MARKER = "mb_device_bootstrapped";
const LOCK_NAME = "mb-daily-device-bootstrap";

let inFlight: Promise<void> | null = null;

function hasMarker(): boolean {
  try {
    return window.localStorage.getItem(BOOTSTRAP_MARKER) === "1";
  } catch {
    // Private mode / storage disabled — fall back to bootstrapping each load.
    return false;
  }
}

function setMarker(): void {
  try {
    window.localStorage.setItem(BOOTSTRAP_MARKER, "1");
  } catch {
    // Non-fatal: without the marker we simply bootstrap again next load.
  }
}

async function bootstrap(): Promise<void> {
  // Re-checked inside the lock: a tab that queued here may find the tab that
  // held the lock already did the work.
  if (hasMarker()) return;
  try {
    await fetch("/api/daily/device", { method: "POST" });
    setMarker();
  } catch {
    // A failed bootstrap must not block rendering; the next daily request
    // mints the device server-side anyway.
  }
}

export function ensureDailyDevice(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (typeof window === "undefined") return;

    const locks = navigator.locks;
    if (!locks) {
      // No Web Locks (older Safari): the marker still collapses the common
      // case, leaving only the simultaneous-first-visit window open.
      await bootstrap();
      return;
    }

    await locks.request(LOCK_NAME, bootstrap);
  })();

  return inFlight;
}
