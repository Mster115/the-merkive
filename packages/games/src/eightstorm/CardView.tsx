"use client";

import * as React from "react";
import { cn } from "@merky/ui";
import type { Card as CardType, Rank, Suit } from "./cards";
import { ClubIcon, DiamondIcon, HeartIcon, LightningIcon, ReverseIcon, SkipIcon, SpadeIcon, StarIcon } from "./icons";

export const SUIT_NAMES: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
  X: "Joker",
};

export function SuitSVG({ suit, className = "w-4 h-4" }: { suit: Suit; className?: string }) {
  switch (suit) {
    case "S":
      return <SpadeIcon className={className} />;
    case "H":
      return <HeartIcon className={className} />;
    case "D":
      return <DiamondIcon className={className} />;
    case "C":
      return <ClubIcon className={className} />;
    case "X":
      return <StarIcon className={className} />;
  }
}

export function getCardDisplayRank(rank: Rank): string {
  switch (rank) {
    case "A":
      return "REV";
    case "J":
      return "SKIP";
    case "2":
      return "+2";
    case "8":
      return "WILD";
    case "JOKER":
      return "JKR";
    default:
      return rank;
  }
}

export function getCardActionLabel(rank: Rank, suit: Suit): string {
  const suitName = SUIT_NAMES[suit];
  switch (rank) {
    case "A":
      return `Reverse (${suitName})`;
    case "J":
      return `Skip (${suitName})`;
    case "2":
      return `+2 Draw (${suitName})`;
    case "8":
      return `Wild 8 (${suitName})`;
    case "JOKER":
      return "Joker (wild)";
    default:
      return `${rank} of ${suitName}`;
  }
}

interface CardViewProps {
  card: CardType;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function CardView({ card, selected, disabled, onClick, className, size = "md" }: CardViewProps) {
  const isRed = card.suit === "H" || card.suit === "D";
  const isWild = card.rank === "8" || card.suit === "X";
  const displayRank = getCardDisplayRank(card.rank);

  const sizeClasses = {
    sm: "w-14 h-22 p-1.5 text-xs rounded-lg border-2 min-h-[44px]",
    md: "w-22 h-34 p-2.5 text-sm rounded-xl border-[3px] min-h-[44px]",
    lg: "w-32 h-48 p-3.5 text-base rounded-2xl border-4 min-h-[44px]",
    xl: "w-44 h-64 p-5 text-xl rounded-3xl border-4 min-h-[44px]",
  }[size];

  const iconSizeClass = {
    sm: "w-5 h-5",
    md: "w-9 h-9",
    lg: "w-14 h-14",
    xl: "w-20 h-20",
  }[size];

  const cornerSuitSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6",
    xl: "w-8 h-8",
  }[size];

  const actionLabel = getCardActionLabel(card.rank, card.suit);
  const textColor = isRed ? "text-[#dc2626]" : "text-black";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={actionLabel}
      className={cn(
        "flex flex-col justify-between select-none relative font-black transition-all duration-150 transform text-left overflow-hidden bg-white border-black shadow-[2px_2px_0_0_#000] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--mb-accent-2)]",
        "[font-family:var(--mb-font-display)]",
        sizeClasses,
        textColor,
        disabled
          ? "opacity-40 grayscale cursor-not-allowed scale-95 shadow-none"
          : "cursor-pointer mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:-translate-y-1.5",
        selected && "ring-4 ring-[var(--mb-accent-2)] -translate-y-3 shadow-[4px_4px_0_0_#000] border-black bg-white z-20",
        className
      )}
    >
      {/* Top Left Corner Index */}
      <div className="flex flex-col items-start leading-none z-10 gap-0.5">
        <span className="font-black text-[0.85em] tracking-tighter uppercase">{displayRank}</span>
        <SuitSVG suit={card.suit} className={cornerSuitSize} />
      </div>

      {/* Center Action Symbol / Icon */}
      <div className="self-center text-center my-auto z-10 flex flex-col items-center justify-center gap-1">
        {card.rank === "A" ? (
          <>
            <ReverseIcon className={cn(iconSizeClass, "text-[var(--mb-violet)]")} />
            <span className="text-[0.6em] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--mb-violet)] text-white border-2 border-black shadow-[1px_1px_0_0_#000]">
              REVERSE
            </span>
          </>
        ) : card.rank === "J" ? (
          <>
            <SkipIcon className={cn(iconSizeClass, "text-[var(--mb-pink-deep)]")} />
            <span className="text-[0.6em] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--mb-pink)] text-black border-2 border-black shadow-[1px_1px_0_0_#000]">
              SKIP
            </span>
          </>
        ) : card.rank === "2" ? (
          <>
            <LightningIcon className={cn(iconSizeClass, "text-[var(--mb-gold)]")} />
            <span className="text-[0.65em] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--mb-danger)] text-white border-2 border-black shadow-[1px_1px_0_0_#000]">
              +2 DRAW
            </span>
          </>
        ) : isWild ? (
          <>
            <StarIcon className={cn(iconSizeClass, "text-[var(--mb-gold)]")} />
            <span className="text-[0.6em] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--mb-gold)] text-black border-2 border-black shadow-[1px_1px_0_0_#000]">
              {card.rank === "JOKER" ? "JOKER" : "WILD 8"}
            </span>
          </>
        ) : (
          <SuitSVG suit={card.suit} className={iconSizeClass} />
        )}
      </div>

      {/* Bottom Right Corner Index (Inverted) */}
      <div className="flex flex-col items-end leading-none rotate-180 z-10 self-end gap-0.5">
        <span className="font-black text-[0.85em] tracking-tighter uppercase">{displayRank}</span>
        <SuitSVG suit={card.suit} className={cornerSuitSize} />
      </div>
    </button>
  );
}
