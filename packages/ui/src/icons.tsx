import * as React from "react";
import { cn } from "./cn";

/** Shared neo-brutalist line-icon set: bold currentColor strokes/fills, 24x24 viewBox.
 *  Swap-in replacements for emoji so glyphs render identically everywhere. */

export function LockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="11" width="15" height="10" rx="2" fill="currentColor" fillOpacity="0.18" />
      <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M12 17v2" />
    </svg>
  );
}

export function CrownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M5 18h14l1-11-4 3-4-6-4 6-4-3 1 11z" />
      <circle cx="5" cy="7" r="1.5" fill="#fff" />
      <circle cx="12" cy="4" r="1.5" fill="#fff" />
      <circle cx="19" cy="7" r="1.5" fill="#fff" />
    </svg>
  );
}

export function CloseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export function TrophyIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" strokeWidth="2.5" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 5l1.2 2.4 2.8.4-2 2 .5 2.7L12 11.2 9.5 12.5l.5-2.7-2-2 2.8-.4L12 5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Dizzy/glitched face — generic "something broke" error indicator. */
export function GlitchFaceIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" fill="currentColor" fillOpacity="0.12" />
      <line x1="7" y1="9" x2="10" y2="11.5" />
      <line x1="10" y1="9" x2="7" y2="11.5" />
      <line x1="14" y1="9" x2="17" y2="11.5" />
      <line x1="17" y1="9" x2="14" y2="11.5" />
      <path d="M7.5 16c1.5-1.4 3.3-1.4 4.5 0 1.2-1.4 3-1.4 4.5 0" />
    </svg>
  );
}

export function BootIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v6.5l4.2 3.3c.9.7 1.3 1.8 1.1 2.9l-.4 2.3H4v-4c0-1 .4-2 1.2-2.7L9 8.5V3z" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function ClockIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" fill="currentColor" fillOpacity="0.12" />
      <path d="M12 7v5.5l3.8 2.2" />
    </svg>
  );
}

export function SpeakerOnIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4h3.5L13 18V6L7.5 10H4z" fill="currentColor" fillOpacity="0.18" />
      <path d="M16.5 9a4 4 0 0 1 0 6" />
      <path d="M19 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}

export function SpeakerOffIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4h3.5L13 18V6L7.5 10H4z" fill="currentColor" fillOpacity="0.18" />
      <line x1="16" y1="9" x2="21" y2="15" />
      <line x1="21" y1="9" x2="16" y2="15" />
    </svg>
  );
}

export function LightningIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h8l-2 8 12-12h-8l3-8z" />
    </svg>
  );
}

export function ToolsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8z"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

export function PuzzleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M4 4h6a2 2 0 1 1 4 0h6v6a2 2 0 1 0 0 4v6h-6a2 2 0 1 1-4 0H4v-6a2 2 0 1 0 0-4V4z"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

export function BackpackIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8V6a5 5 0 0 1 10 0v2" />
      <rect x="5" y="8" width="14" height="13" rx="3" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 12h6" />
      <rect x="9" y="15" width="6" height="4" rx="1" />
    </svg>
  );
}

export function CardsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="12" height="16" rx="2" transform="rotate(-8 12 11)" fill="currentColor" fillOpacity="0.12" />
      <rect x="6" y="5" width="12" height="16" rx="2" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

export function PencilIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z" fill="currentColor" fillOpacity="0.15" />
      <path d="M13 7l3.5 3.5" />
    </svg>
  );
}

const RANK_STYLES = [
  { bg: "var(--mb-gold)", fg: "#3a2a00" },
  { bg: "#d7dee8", fg: "#2a3140" },
  { bg: "#e3a765", fg: "#3a2200" },
];

/** Rank 1/2/3 badge (medal replacement) — falls back to a plain number past 3rd. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  const style = RANK_STYLES[rank];
  if (!style) {
    return (
      <span className={cn("inline-flex items-center justify-center font-black", className)} aria-hidden="true">
        {rank + 1}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full border-2 border-black font-black text-xs", className)}
      style={{ background: style.bg, color: style.fg }}
      aria-hidden="true"
    >
      {rank + 1}
    </span>
  );
}
