import * as React from "react";
import { cn } from "./cn";
import { AvatarFace } from "./PlayerChip";
import { CountUp } from "./CountUp";

export interface ScoreRow {
  seatIndex: number;
  displayName: string;
  avatarId: string;
  points: number;
  abandoned?: boolean;
}

const medals = ["🥇", "🥈", "🥉"];

export function ScoreBoard({
  rows,
  compact,
  animated,
  pointsLabel = "pts",
  className,
}: {
  rows: ScoreRow[];
  compact?: boolean;
  /** Count-up score numbers + staggered row entrances (podium moments). */
  animated?: boolean;
  pointsLabel?: string;
  className?: string;
}) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.seatIndex - b.seatIndex);
  return (
    <ol className={cn("flex flex-col gap-2", animated && "mb-stagger", className)} aria-label="scoreboard">
      {sorted.map((r, i) => (
        <li
          key={r.seatIndex}
          style={animated ? ({ "--mb-i": i } as React.CSSProperties) : undefined}
          className={cn(
            "flex items-center gap-3 rounded-sm px-3 border-2 bg-[var(--mb-surface-2)]",
            compact ? "min-h-10 text-sm" : "min-h-13",
            animated && "mb-rise",
            i === 0 && !compact
              ? "border-[var(--mb-gold)] shadow-[4px_4px_0_0_var(--mb-gold)]"
              : "border-black shadow-[2px_2px_0_0_#000]",
            r.abandoned && "opacity-50 saturate-50 shadow-none"
          )}
        >
          <span
            className={cn("w-7 text-center font-black", animated && i === 0 && "mb-tada")}
            aria-hidden="true"
          >
            {medals[i] ?? i + 1}
          </span>
          <AvatarFace avatarId={r.avatarId} size={compact ? 24 : 30} />
          <span className="font-bold truncate">{r.displayName}</span>
          <span className="ml-auto font-black tabular-nums text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
            {animated ? <CountUp value={r.points} /> : r.points}
            <span className="ml-1 text-xs font-bold text-[var(--mb-text-dim)]">{pointsLabel}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
