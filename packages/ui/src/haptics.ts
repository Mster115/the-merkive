"use client";

/** Best-effort haptic feedback for controller taps. Silently no-ops. */
export function buzz(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // not supported — fine
  }
}
