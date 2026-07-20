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
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const COLOR_MAP: Record<number, { name: string; textClass: string; barClass: string; symbol: string }> = {
  0: { name: "purple", textClass: "text-[#7c3aed]", barClass: "bg-[#7c3aed]/20", symbol: "●" },
  1: { name: "red", textClass: "text-[#dc2626]", barClass: "bg-[#dc2626]/20", symbol: "◆" },
  2: { name: "green", textClass: "text-[#16a34a]", barClass: "bg-[#16a34a]/20", symbol: "▲" },
  3: { name: "amber", textClass: "text-[#d97706]", barClass: "bg-[#d97706]/20", symbol: "■" },
};

export const TileComponent: React.FC<TileComponentProps> = ({
  tile,
  selected,
  onClick,
  size = "md",
  disabled,
  className,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const isJoker = Boolean(tile.joker);
  const colorInfo = COLOR_MAP[tile.c] ?? COLOR_MAP[0]!;

  const sizeClasses = {
    sm: "w-11 h-15 text-xl rounded-md p-1 border-2 border-black",
    md: "w-14 h-18 text-2xl rounded-lg p-1.5 border-[3px] border-black",
    lg: "w-18 h-24 text-4xl rounded-xl p-2 border-4 border-black",
  }[size];

  const ariaLabel = isJoker ? "joker" : `${colorInfo.name} ${tile.n}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col items-center justify-between font-black select-none transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent-2)]",
        isJoker
          ? "bg-[var(--mb-surface-3)] text-[var(--mb-gold)] shadow-[2px_2px_0_0_#000]"
          : "bg-white text-black shadow-[2px_2px_0_0_#000]",
        "[font-family:var(--mb-font-display)]",
        sizeClasses,
        selected &&
          "ring-4 ring-[var(--mb-accent-2)] shadow-[4px_4px_0_0_#000] -translate-y-1.5 scale-105 z-10 border-black bg-white",
        disabled && "opacity-50 cursor-not-allowed",
        onClick &&
          !disabled &&
          "cursor-pointer mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:-translate-y-1",
        className
      )}
    >
      {/* Top indicator icon */}
      <span
        className={cn(
          "text-[10px] font-black leading-none opacity-90 self-start tracking-wider",
          isJoker ? "text-[var(--mb-gold)]" : colorInfo.textClass
        )}
      >
        {isJoker ? "WILD" : colorInfo.symbol}
      </span>

      {/* Main tile content */}
      <span
        className={cn(
          "font-black tracking-tighter my-auto leading-none",
          isJoker ? "text-[var(--mb-gold)] text-2xl" : colorInfo.textClass
        )}
      >
        {isJoker ? "★" : tile.n}
      </span>

      {/* Bottom marker bar */}
      <div
        className={cn(
          "w-full h-1 rounded-full mt-0.5",
          isJoker ? "bg-[var(--mb-gold)]/30" : colorInfo.barClass
        )}
      />
    </button>
  );
};
