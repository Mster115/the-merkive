"use client";
import * as React from "react";
import { useT } from "@/i18n";
import { ensureDailyDevice } from "@/client/dailyDevice";
import type { TickerItem } from "@/components/Ticker";

interface SummaryGame {
  id: string;
  nameKey: string;
  hasPuzzle: boolean;
  status: "unplayed" | "in_progress" | "solved" | "failed";
  currentStreak: number;
}

interface Summary {
  today: string;
  msUntilRollover: number;
  games: SummaryGame[];
}

/** "6h 12m" / "48m" / "40s" — coarse on purpose; this is glanceable, not a timer. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

/**
 * Context-aware items for the bottom ticker on the daily surfaces.
 *
 * `gameId` narrows it to a single game (the play page); omit it for the hub,
 * where every game gets a line. Returns [] until the summary loads so the
 * caller can skip rendering rather than flash placeholder text.
 *
 * `refreshKey` refetches when it changes — pass the attempt's terminal state so
 * solving a puzzle updates the strip instead of leaving it on "ready to play".
 */
export function useDailyTickerItems(gameId?: string, refreshKey?: string | number): TickerItem[] {
  const t = useT();
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
        // A ticker is ambient; failing to load it must not surface an error.
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

  return React.useMemo(() => {
    if (!summary) return [];

    const remaining = summary.msUntilRollover - elapsedMs;
    const items: TickerItem[] = [];

    items.push(
      remaining <= 60_000
        ? { text: t("daily.ticker.rollover.soon"), tone: "urgent" }
        : {
            text: t("daily.ticker.rollover", { time: formatCountdown(remaining) }),
            tone: remaining <= 3_600_000 ? "urgent" : "default",
          }
    );

    const scoped = gameId ? summary.games.filter((g) => g.id === gameId) : summary.games;
    const playable = scoped.filter((g) => g.hasPuzzle);

    // On the hub, lead with the win when there is nothing left to do today.
    if (!gameId && playable.length > 0 && playable.every((g) => g.status === "solved")) {
      items.push({ text: t("daily.ticker.allSolved"), tone: "good" });
    }

    for (const game of scoped) {
      const name = t(game.nameKey);
      if (!game.hasPuzzle) {
        items.push({ text: t("daily.ticker.none", { game: name }) });
        continue;
      }
      switch (game.status) {
        case "solved":
          items.push({ text: t("daily.ticker.solved", { game: name }), tone: "good" });
          break;
        case "failed":
          items.push({ text: t("daily.ticker.failed", { game: name }) });
          break;
        case "in_progress":
          items.push({ text: t("daily.ticker.inProgress", { game: name }), tone: "urgent" });
          break;
        default:
          items.push({ text: t("daily.ticker.ready", { game: name }) });
      }
      if (game.currentStreak > 0) {
        items.push({
          text: t("daily.ticker.streak", { game: name, days: game.currentStreak }),
          tone: "good",
        });
      }
    }

    items.push({ text: t("daily.ticker.tagline") });
    return items;
  }, [summary, elapsedMs, gameId, t]);
}
