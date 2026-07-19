import * as React from "react";

export function ReverseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SkipIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" strokeWidth="3" />
    </svg>
  );
}

export function LightningIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h8l-2 8 12-12h-8l3-8z" />
      <circle cx="19" cy="5" r="1.5" className="opacity-80" />
      <circle cx="4" cy="19" r="1.5" className="opacity-80" />
    </svg>
  );
}

export function DeckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="13" height="15" rx="3" fill="currentColor" fillOpacity="0.1" />
      <path d="M7 3.5h11a2.5 2.5 0 0 1 2.5 2.5v11" />
      <path d="M10 10.5h.01" strokeWidth="3" />
      <path d="M13 13.5h.01" strokeWidth="3" />
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
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 5l1.2 2.4 2.8.4-2 2 .5 2.7L12 11.2 9.5 12.5l.5-2.7-2-2 2.8-.4L12 5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FanIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="5" width="10" height="15" rx="2" transform="rotate(-18 12 12.5)" />
      <rect x="7" y="5" width="10" height="15" rx="2" transform="rotate(18 12 12.5)" />
      <rect x="7" y="5" width="10" height="15" rx="2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

export function GridIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.15" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.15" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.15" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

export function StarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.8 6.2 6.7.6-5 4.5 1.5 6.5-6-3.4-6 3.4 1.5-6.5-5-4.5 6.7-.6L12 2z" />
      <circle cx="4" cy="4" r="1" />
      <circle cx="20" cy="4" r="1" />
      <circle cx="20" cy="20" r="1" />
    </svg>
  );
}

/* Whimsical Suit Icons */
export function SpadeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5C9.5 7 4 10.5 4 14.5c0 3 2.5 5 5.5 5 1.7 0 3-.7 4.2-2.1.2.7.5 1.4 1.3 2.1H9v2h6v-2h-2c.8-.7 1.1-1.4 1.3-2.1 1.2 1.4 2.5 2.1 4.2 2.1 3 0 5.5-2 5.5-5 0-4-5.5-7.5-8-12z" />
    </svg>
  );
}

export function HeartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export function DiamondIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L3.5 12 12 22l8.5-10L12 2z" />
    </svg>
  );
}

export function ClubIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a4 4 0 0 0-4 4c0 1.2.5 2.3 1.4 3A4 4 0 0 0 5 13a4 4 0 0 0 6 3.5c.2.7.5 1.4 1.3 2.1H10v2h4v-2h-2.3c.8-.7 1.1-1.4 1.3-2.1A4 4 0 0 0 19 13a4 4 0 0 0-4.4-4c.9-.7 1.4-1.8 1.4-3a4 4 0 0 0-4-4z" />
    </svg>
  );
}
