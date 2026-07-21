"use client";

import * as React from "react";
import type { Translate } from "@merky/game-sdk";
import { cn, TrophyIcon } from "@merky/ui";
import { powerForNthMerkite } from "./helpers";
import type { Board, PowerKind } from "./types";
import { AuditIcon, BanishIcon, PeekIcon, SnapIcon } from "./icons";

const POWER_ICON: Record<PowerKind, React.ComponentType<{ className?: string }>> = {
  audit: AuditIcon,
  snap: SnapIcon,
  peek: PeekIcon,
  banish: BanishIcon,
};

/** One decree track — the chunky slotted card rail. Merkite slots preview their power icon ahead of time. */
export function DecreeTrack({
  team,
  enacted,
  board,
  t,
}: {
  team: "merkizen" | "merkite";
  enacted: number;
  board: Board;
  t: Translate;
}) {
  const isMerkite = team === "merkite";
  const total = isMerkite ? 6 : 5;
  const tone = isMerkite
    ? { bg: "bg-[var(--mb-danger)]", on: "text-[var(--mb-on-danger)]", text: "text-[var(--mb-danger)]" }
    : { bg: "bg-[var(--mb-accent-2)]", on: "text-[var(--mb-on-accent-2)]", text: "text-[var(--mb-accent-2)]" };

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 w-full">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs sm:text-sm font-black uppercase tracking-wider [font-family:var(--mb-font-display)]",
            tone.text
          )}
        >
          {t(isMerkite ? "games.merkissioner.ui.merkite_track" : "games.merkissioner.ui.merkizen_track")}
        </span>
        <span className="text-xs font-black text-[var(--mb-text-dim)] tabular-nums">
          {enacted}/{total}
        </span>
      </div>
      <div className="flex gap-1 sm:gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const slotNumber = i + 1;
          const filled = slotNumber <= enacted;
          const power = isMerkite ? powerForNthMerkite(board, slotNumber) : null;
          const isWinSlot = slotNumber === total;
          const Icon = power ? POWER_ICON[power] : null;
          return (
            <div
              key={slotNumber}
              className={cn(
                "flex-1 aspect-[3/4] min-w-0 rounded-lg border-2 sm:border-[3px] border-black flex items-center justify-center relative",
                filled
                  ? cn(tone.bg, "shadow-[2px_2px_0_0_#000] mb-flip-in")
                  : "bg-[var(--mb-surface-2)] border-dashed border-[var(--mb-line-dim)]"
              )}
              style={filled ? { animationDelay: `${Math.min(i, 6) * 60}ms` } : undefined}
              title={power ? t(`games.merkissioner.power.${power}`) : undefined}
            >
              {filled ? (
                <span className={cn("text-base sm:text-2xl font-black [font-family:var(--mb-font-display)]", tone.on)}>
                  {slotNumber}
                </span>
              ) : Icon ? (
                <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-[var(--mb-text-dim)]" />
              ) : isWinSlot ? (
                <TrophyIcon className="w-4 h-4 sm:w-6 sm:h-6 text-[var(--mb-gold)] opacity-70" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Three fat pips — blinks a warning once gridlock hits 2/3. */
export function GridlockMeter({ gridlock, t }: { gridlock: number; t: Translate }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[0.65rem] sm:text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
        {t("games.merkissioner.ui.gridlock_meter")}
      </span>
      <div className="flex gap-1.5" role="img" aria-label={`${gridlock}/3`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "w-6 h-8 sm:w-8 sm:h-10 rounded-md border-2 border-black",
              i < gridlock ? cn("bg-[var(--mb-warn)]", gridlock >= 2 && "mb-blink") : "bg-[var(--mb-surface-3)]"
            )}
          />
        ))}
      </div>
      {gridlock >= 2 && (
        <span className="text-[0.6rem] sm:text-[0.65rem] font-black uppercase text-[var(--mb-warn)] text-center max-w-[8rem] [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.ui.gridlock_warning")}
        </span>
      )}
    </div>
  );
}
