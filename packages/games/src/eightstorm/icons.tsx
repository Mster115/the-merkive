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

/* Eightstorm Elemental Suit Icons */
export function BoltIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.35 8.04C18.67 4.59 15.64 2 12 2C9.11 2 6.6 3.64 5.35 6.04C2.34 6.36 0 8.91 0 12c0 3.31 2.69 6 6 6h2.5l-2 5 7.5-6.5h-4l3.5-4.5h-4l3-3.5H12L9.5 10h3L10.5 14H18c3.31 0 6-2.69 6-6 0-3.09-2.34-5.64-5.35-5.96z" />
    </svg>
  );
}

export function BlazeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 2C13.5 2 14 5 12 7C10 5 10 3 10 3C7 6 6 10 6 13.5C6 17.09 8.91 20 12.5 20C16.09 20 19 17.09 19 13.5C19 9 15.5 5.5 13.5 2ZM12.5 18C10.57 18 9 16.43 9 14.5C9 13.4 9.5 12.1 10.3 11.3C10.6 12.8 11.9 14 13.5 14C14.3 14 15 13.7 15.5 13.2C15.8 14.2 15.8 15.3 15.3 16.2C14.7 17.3 13.7 18 12.5 18Z" />
    </svg>
  );
}

export function GaleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.8 3a3.8 3.8 0 0 0-3.8 3.8c0 2.1 1.7 3.8 3.8 3.8H2" />
      <path d="M17.5 9a3.5 3.5 0 0 1 3.5 3.5c0 1.9-1.6 3.5-3.5 3.5H2" />
      <path d="M9.8 21a2.8 2.8 0 0 0 2.8-2.8c0-1.5-1.3-2.8-2.8-2.8H4" />
    </svg>
  );
}

export function TideIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c2.5 0 2.5 2.5 5 2.5s2.5-2.5 5-2.5 2.5 2.5 5 2.5 2.5-2.5 5-2.5" />
      <path d="M2 12c2.5 0 2.5 2.5 5 2.5s2.5-2.5 5-2.5 2.5 2.5 5 2.5 2.5-2.5 5-2.5" />
      <path d="M2 18c2.5 0 2.5 2.5 5 2.5s2.5-2.5 5-2.5 2.5 2.5 5 2.5 2.5-2.5 5-2.5" />
    </svg>
  );
}
