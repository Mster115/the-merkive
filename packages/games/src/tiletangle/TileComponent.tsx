import * as React from "react";
import { cn } from "@merky/ui";
import type { Tile } from "./tiles";

export interface TileComponentProps {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const COLOR_MAP: Record<number, { name: string; textClass: string; bgClass: string; symbol: string }> = {
  0: { name: "blue", textClass: "text-blue-700", bgClass: "bg-blue-500/10 border-blue-500/30", symbol: "●" },
  1: { name: "red", textClass: "text-red-600", bgClass: "bg-red-500/10 border-red-500/30", symbol: "◆" },
  2: { name: "green", textClass: "text-emerald-700", bgClass: "bg-emerald-500/10 border-emerald-500/30", symbol: "▲" },
  3: { name: "amber", textClass: "text-amber-600", bgClass: "bg-amber-500/10 border-amber-500/30", symbol: "■" },
};

export const TileComponent: React.FC<TileComponentProps> = ({
  tile,
  selected,
  onClick,
  size = "md",
  disabled,
  className,
}) => {
  const isJoker = Boolean(tile.joker);
  const colorInfo = COLOR_MAP[tile.c] ?? COLOR_MAP[0]!;

  const sizeClasses = {
    sm: "w-10 h-14 text-lg rounded-md p-1 border-2 border-black",
    md: "w-12 h-16 text-xl rounded-lg p-1.5 border-2 border-black",
    lg: "w-16 h-22 text-3xl rounded-xl p-2 border-[3px] border-black",
  }[size];

  const ariaLabel = isJoker ? "joker" : `${colorInfo.name} ${tile.n}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col items-center justify-between font-extrabold select-none transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent-2)]",
        "bg-[var(--mb-paper)] text-black shadow-[2px_2px_0_0_#000]",
        "[font-family:var(--mb-font-display)]",
        sizeClasses,
        selected &&
          "ring-4 ring-[var(--mb-accent-2)] shadow-[4px_4px_0_0_#000] -translate-y-1 scale-105 z-10 border-black bg-[var(--mb-paper)]",
        disabled && "opacity-50 cursor-not-allowed",
        onClick && !disabled && "cursor-pointer mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5",
        className
      )}
    >
      {/* Top indicator icon */}
      <span className={cn("text-[10px] font-black leading-none opacity-90 self-start", isJoker ? "text-purple-600" : colorInfo.textClass)}>
        {isJoker ? "★" : colorInfo.symbol}
      </span>

      {/* Main tile content */}
      <span
        className={cn(
          "font-black tracking-tighter my-auto leading-none",
          isJoker ? "text-purple-600 text-2xl" : colorInfo.textClass
        )}
      >
        {isJoker ? "★" : tile.n}
      </span>

      {/* Bottom marker */}
      <span className={cn("text-[9px] font-black leading-none opacity-60 self-end font-mono", isJoker ? "text-purple-600" : colorInfo.textClass)}>
        {isJoker ? "J" : colorInfo.symbol}
      </span>
    </button>
  );
};
