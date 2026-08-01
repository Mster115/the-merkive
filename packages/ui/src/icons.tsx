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

export function InfoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" fill="currentColor" fillOpacity="0.12" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.75" r="1.15" fill="currentColor" stroke="none" />
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

export function PaletteIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7.3-9-7.3z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" />
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

export function ZaplashIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" fill="var(--mb-pink)" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <path d="M13 6l-5 7.5h4.5l-1.5 5.5 6-7.5h-4.5l1.5-5.5z" fill="var(--mb-gold)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EightstormIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="11" height="15" rx="2" transform="rotate(-12 8.5 12.5)" fill="var(--mb-accent)" fillOpacity="0.3" stroke="currentColor" />
      <rect x="9" y="4" width="12" height="16" rx="2" fill="var(--mb-surface)" stroke="currentColor" strokeWidth="2" />
      <circle cx="15" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.8" fill="var(--mb-gold)" fillOpacity="0.4" />
      <circle cx="15" cy="14.5" r="2.8" stroke="currentColor" strokeWidth="1.8" fill="var(--mb-gold)" fillOpacity="0.4" />
    </svg>
  );
}

export function TileTangleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="7" height="12" rx="1.5" fill="var(--mb-accent-2)" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <rect x="8.5" y="4" width="7" height="12" rx="1.5" fill="var(--mb-gold)" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 7.5h3" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14.5" y="8" width="7" height="12" rx="1.5" fill="var(--mb-pink)" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MerkissionerIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="3" width="10" height="7" rx="1" fill="var(--mb-danger)" fillOpacity="0.35" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 10h15" stroke="currentColor" strokeWidth="2" />
      <path d="M8 15c1.2-1.6 3-1.2 4 0 1-1.2 2.8-1.6 4 0-1 1.4-2.8 1.8-4 .6-1.2 1.2-3 .8-4-.6z" fill="var(--mb-gold)" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="19.5" r="2" stroke="currentColor" strokeWidth="1.6" fill="var(--mb-paper)" fillOpacity="0.25" />
      <path d="M14.6 19.5H7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function YouGotItIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18a9 9 0 0 1 18 0z" fill="var(--mb-accent)" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 18 8.4 10.6" stroke="var(--mb-gold)" strokeWidth="2.4" />
      <circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5.2 14.4l1.7 1M18.8 14.4l-1.7 1M12 9.2v2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function NexusIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="var(--mb-surface)" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="9" width="6" height="6" fill="var(--mb-gold)" fillOpacity="0.55" stroke="none" />
      <path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function NutshellIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="var(--mb-surface)" stroke="currentColor" strokeWidth="2" />
      {/* Blocked squares — the thing that reads as "crossword" rather than
          "grid", and what distinguishes this from Nexus's 3x3 at icon size. */}
      <rect x="3.6" y="3.6" width="3.6" height="3.6" fill="currentColor" fillOpacity="0.85" stroke="none" />
      <rect x="16.8" y="16.8" width="3.6" height="3.6" fill="currentColor" fillOpacity="0.85" stroke="none" />
      <rect x="10.2" y="10.2" width="3.6" height="3.6" fill="var(--mb-accent-2)" fillOpacity="0.55" stroke="none" />
      <path d="M6.6 3.5v17M10.2 3.5v17M13.8 3.5v17M17.4 3.5v17" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.5 6.6h17M3.5 10.2h17M3.5 13.8h17M3.5 17.4h17" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function RelayIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="8" width="7" height="8" rx="1.5" fill="var(--mb-accent)" fillOpacity="0.35" stroke="currentColor" strokeWidth="2" />
      <rect x="14.5" y="8" width="7" height="8" rx="1.5" fill="var(--mb-gold)" fillOpacity="0.45" stroke="currentColor" strokeWidth="2" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="2" />
      <path d="M12.6 10.4 14.6 12l-2 1.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function WaypointIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill="var(--mb-surface)" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="var(--mb-accent)" strokeWidth="1.5" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="2" fill="var(--mb-gold)" stroke="currentColor" strokeWidth="1" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function MerkadeIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="15" width="18" height="6" rx="2" fill="var(--mb-accent)" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 15V8" />
      <circle cx="12" cy="6" r="2.6" fill="var(--mb-gold)" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="7.5" cy="18" r="1.4" fill="var(--mb-pink)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16.5" cy="18" r="1.4" fill="var(--mb-pink)" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

/**
 * A compass needle pointing along `bearingDeg` (0 = north, clockwise).
 * Waypoint renders one of these per guess in place of a directional glyph —
 * it rotates continuously, so it carries the exact bearing rather than
 * snapping to one of eight arrows.
 */
/**
 * Direction arrow, snapped to one of eight compass sectors.
 *
 * Takes an octant rather than an angle on purpose. This previously rotated by
 * a raw `bearingDeg`, which meant the rendered pixels encoded the exact
 * bearing — enough, with the distance, to solve Waypoint in a single guess.
 */
export function BearingArrowIcon({
  octant = 0,
  className = "w-5 h-5",
}: {
  /** 0 = N, increasing clockwise through 7 = NW. */
  octant?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${(((octant % 8) + 8) % 8) * 45}deg)` }}
    >
      <path d="M12 3.5v17" />
      <path d="M6.5 9L12 3.5 17.5 9" />
    </svg>
  );
}

/** Concentric bullseye — the target has been hit. */
export function TargetIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function QuestionIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" fill="currentColor" fillOpacity="0.12" />
      <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.45-1.2.9-1.2 1.8" />
      <circle cx="12" cy="16.9" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.12" />
      <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
    </svg>
  );
}

export function LightbulbIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 15.5a5.5 5.5 0 1 1 8 0c-.7.7-1 1.4-1 2.5h-6c0-1.1-.3-1.8-1-2.5z" fill="currentColor" fillOpacity="0.18" />
      <path d="M10 21h4" />
      <path d="M12 2.5v1.5" />
    </svg>
  );
}

export function BackspaceIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5h10.5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6.2-6.6a1 1 0 0 1 0-1.4L9 5z" fill="currentColor" fillOpacity="0.15" />
      <line x1="13" y1="9.5" x2="18" y2="14.5" />
      <line x1="18" y1="9.5" x2="13" y2="14.5" />
    </svg>
  );
}

export function SwapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13.5M17.5 8L14 4.5M20 16H6.5M6.5 16L10 19.5" />
    </svg>
  );
}

export function DetourIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 4 18 C 8 18, 8 8, 14 8" stroke="currentColor" strokeWidth="2.5" />
      <path d="M 14 8 L 20 8" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 2" />
      <circle cx="4" cy="18" r="2.5" fill="var(--mb-accent)" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="8" r="2.5" fill="var(--mb-gold)" stroke="currentColor" strokeWidth="2" />
      <path d="M 8 18 C 10 12, 14 14, 17 12" stroke="var(--mb-pink)" strokeWidth="2" strokeDasharray="2 2" />
      <path d="M 15 10.5 L 17.5 12 L 15.5 14" stroke="var(--mb-pink)" strokeWidth="1.8" />
    </svg>
  );
}

export function GameIcon({ gameId, className }: { gameId: string; className?: string }) {
  switch (gameId) {
    case "zaplash":
      return <ZaplashIcon className={className} />;
    case "eightstorm":
      return <EightstormIcon className={className} />;
    case "tiletangle":
      return <TileTangleIcon className={className} />;
    case "merkissioner":
      return <MerkissionerIcon className={className} />;
    case "yougotit":
      return <YouGotItIcon className={className} />;
    case "merkade":
      return <MerkadeIcon className={className} />;
    // Daily games.
    case "detour":
      return <DetourIcon className={className} />;
    case "nexus":
      return <NexusIcon className={className} />;
    case "nutshell":
      return <NutshellIcon className={className} />;
    case "relay":
      return <RelayIcon className={className} />;
    case "waypoint":
      return <WaypointIcon className={className} />;
    default:
      return <PuzzleIcon className={className} />;
  }
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

