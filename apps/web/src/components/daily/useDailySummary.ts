"use client";
import * as React from "react";
import { ensureDailyDevice } from "@/client/dailyDevice";

export interface SummaryGame {
  id: string;
  nameKey: string;
  hasPuzzle: boolean;
  status: "unplayed" | "in_progress" | "solved" | "failed";
  currentStreak: number;
}

export interface Summary {
  today: string;
  msUntilRollover: number;
  games: SummaryGame[];
}

/**
 * This device's state for today across every daily game.
 *
 * One fetch feeds both the hub's cards and its ticker — they were reading the
 * same endpoint for the same reason, and the cards going out of sync with the
 * strip directly under them was the bug this consolidates away: the ticker
 * would say "Nexus: better luck tomorrow" above a card still offering "Play".
 *
 * `refreshKey` refetches when it changes; pass an attempt's terminal state so
 * finishing a puzzle updates immediately.
 */
export function useDailySummary(refreshKey?: string | number) {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  // Fetched once, then ticked down locally — no polling just to move a clock.
  const [elapsedMs, setElapsedMs] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        await ensureDailyDevice();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch("/api/daily/summary", { headers: { "x-mb-tz": tz } });
        if (!res.ok) return;
        const json = (await res.json()) as Summary;
        if (!ignore) {
          setSummary(json);
          setElapsedMs(0);
        }
      } catch {
        // Ambient state; failing to load it must not surface an error.
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  React.useEffect(() => {
    if (!summary) return;
    const id = setInterval(() => setElapsedMs((e) => e + 30_000), 30_000);
    return () => clearInterval(id);
  }, [summary]);

  return { summary, elapsedMs };
}
