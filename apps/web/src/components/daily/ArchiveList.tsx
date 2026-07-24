"use client";
import * as React from "react";
import Link from "next/link";
import { Card, Pill } from "@merky/ui";
import { useT } from "@/i18n";
import { ensureDailyDevice } from "@/client/dailyDevice";

export interface ArchiveListProps {
  gameId: string;
}

export interface ArchiveItem {
  puzzleDate: string;
  status: "solved" | "failed" | "in_progress" | "not_played";
  completedAt: string | null;
  durationMs: number | null;
  score: number | null;
}

export function ArchiveList({ gameId }: ArchiveListProps) {
  const t = useT();
  const [items, setItems] = React.useState<ArchiveItem[]>([]);

  React.useEffect(() => {
    let ignore = false;
    async function fetchArchive() {
      try {
        await ensureDailyDevice();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/daily/${gameId}/archive?limit=30`, {
          headers: { "x-mb-tz": tz },
        });
        if (res.ok) {
          const json = await res.json();
          if (!ignore) setItems(json);
        }
      } catch {
        // ignore fetch error
      }
    }
    void fetchArchive();
    return () => {
      ignore = true;
    };
  }, [gameId]);

  if (items.length === 0) return null;

  return (
    <Card raised className="flex flex-col gap-3 bg-[var(--mb-surface-2)] p-4 rotate-0.5 border-3 border-black shadow-[4px_4px_0_0_#000]">
      <h3 className="text-sm font-black uppercase text-[var(--mb-violet)] tracking-wider">
        {t("daily.archive.title")}
      </h3>
      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
        {items.map((item) => {
          const tone =
            item.status === "solved"
              ? "ok"
              : item.status === "failed"
              ? "warn"
              : "neutral";
          const statusText = t(`daily.archive.status.${item.status}`);

          return (
            <Link
              key={item.puzzleDate}
              href={`/daily/${gameId}/${item.puzzleDate}`}
              className="flex items-center justify-between p-2 rounded bg-black/60 hover:bg-black/90 border border-black transition-colors"
            >
              <span className="font-mono text-xs font-bold text-white">
                {item.puzzleDate}
              </span>
              <Pill tone={tone}>{statusText}</Pill>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
