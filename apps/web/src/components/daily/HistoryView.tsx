"use client";
import * as React from "react";
import { Card } from "@merky/ui";
import { useT } from "@/i18n";
import { ensureDailyDevice } from "@/client/dailyDevice";

export interface HistoryViewProps {
  gameId: string;
  /**
   * Changes when the attempt reaches a terminal state, so the streak panel
   * refetches on solve instead of showing the pre-attempt numbers until the
   * player reloads.
   */
  refreshKey?: string | number;
}

export interface HistoryData {
  streaks: {
    current: number;
    longest: number;
    totalSolved: number;
  };
  stats: {
    totalPlayed: number;
    totalSolved: number;
    winRate: number;
  };
}

export function HistoryView({ gameId, refreshKey }: HistoryViewProps) {
  const t = useT();
  const [data, setData] = React.useState<HistoryData | null>(null);

  React.useEffect(() => {
    let ignore = false;
    async function fetchHistory() {
      try {
        await ensureDailyDevice();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/daily/${gameId}/history`, {
          headers: { "x-mb-tz": tz },
        });
        if (res.ok) {
          const json = await res.json();
          if (!ignore) setData(json);
        }
      } catch {
        // ignore fetch error
      }
    }
    void fetchHistory();
    return () => {
      ignore = true;
    };
  }, [gameId, refreshKey]);

  if (!data) return null;

  return (
    <Card raised className="flex flex-col gap-4 bg-[var(--mb-surface-2)] p-4 -rotate-1 border-3 border-black shadow-[4px_4px_0_0_#000]">
      <h3 className="text-sm font-black uppercase text-[var(--mb-violet)] tracking-wider">
        {t("daily.history.title")}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="bg-black/80 border-2 border-black p-2.5 rounded">
          <span className="block text-2xl font-black text-[var(--mb-accent-2)]">
            {data.streaks.current}
          </span>
          <span className="text-[10px] font-extrabold uppercase text-[var(--mb-text-dim)]">
            {t("daily.history.streak.current")}
          </span>
        </div>
        <div className="bg-black/80 border-2 border-black p-2.5 rounded">
          <span className="block text-2xl font-black text-[var(--mb-gold)]">
            {data.streaks.longest}
          </span>
          <span className="text-[10px] font-extrabold uppercase text-[var(--mb-text-dim)]">
            {t("daily.history.streak.longest")}
          </span>
        </div>
        <div className="bg-black/80 border-2 border-black p-2.5 rounded">
          <span className="block text-2xl font-black text-[var(--mb-accent)]">
            {data.stats.totalSolved}
          </span>
          <span className="text-[10px] font-extrabold uppercase text-[var(--mb-text-dim)]">
            {t("daily.history.totalSolved")}
          </span>
        </div>
        <div className="bg-black/80 border-2 border-black p-2.5 rounded">
          <span className="block text-2xl font-black text-[var(--mb-pink)]">
            {data.stats.winRate}%
          </span>
          <span className="text-[10px] font-extrabold uppercase text-[var(--mb-text-dim)]">
            {t("daily.history.winRate")}
          </span>
        </div>
      </div>
    </Card>
  );
}
