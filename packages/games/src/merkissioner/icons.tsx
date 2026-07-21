import * as React from "react";

/** Merkizen team — a plain dove, wings spread. */
export function MerkizenIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13c3-4 6-3 7-1 1-4 5-6 9-4-2 1-3 2-3 3 4 0 5 2 5 3-3 0-4-1-6-1 1 2 1 4 0 6-1-3-3-4-5-4-3 0-5 1-7-2z" fill="currentColor" fillOpacity="0.2" />
      <circle cx="8.3" cy="10.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Merkite team — a clenched fist (family-friendly, no weapons). */
export function MerkiteIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 11V8.5a1.5 1.5 0 0 1 3 0" />
      <path d="M9 10.5V7.8a1.5 1.5 0 0 1 3 0" />
      <path d="M12 10.5V8a1.5 1.5 0 0 1 3 0v4.5" />
      <path d="M15 10.8a1.5 1.5 0 0 1 3 0V14c0 3.3-2.2 6-6.5 6-3.6 0-5.5-1.8-6.8-4L3 13.7c-.5-.9-.1-1.9.7-2.2.7-.3 1.4 0 1.8.7L6 13" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

/** Mr Merkissioner — the hidden boss, a top hat with a sly little mustache. */
export function BossIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="3" width="10" height="7" rx="1" fill="currentColor" fillOpacity="0.28" />
      <path d="M4.5 10h15" strokeWidth="2.2" />
      <path d="M8 15c1.2-1.6 3-1.2 4 0 1-1.2 2.8-1.6 4 0-1 1.4-2.8 1.8-4 .6-1.2 1.2-3 .8-4-.6z" fill="currentColor" fillOpacity="0.45" strokeWidth="1.6" />
      <circle cx="12" cy="19.5" r="2.1" strokeWidth="1.6" />
      <path d="M9.9 19.5H4.5M14.1 19.5h5.4" strokeWidth="1.6" />
    </svg>
  );
}

/** Chair office — a gavel. */
export function ChairGavelIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="12.2" y="3.2" width="4.4" height="8" rx="1" transform="rotate(45 14.4 7.2)" fill="currentColor" fillOpacity="0.25" />
      <path d="M9.5 8.2l4.3 4.3" strokeWidth="2.4" />
      <path d="M2.5 21.5h9" strokeWidth="2.2" />
      <path d="M4.5 21.5v-4.2a2.5 2.5 0 0 1 2.5-2.5 2.5 2.5 0 0 1 2.5 2.5v4.2" />
    </svg>
  );
}

/** Commissioner office — a star badge. */
export function CommissionerBadgeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.9L12 15.6l-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.7L12 2.5z" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

/** Loyalty Audit power — a magnifying glass over a little ledger. */
export function AuditIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="10" height="13" rx="1.2" fill="currentColor" fillOpacity="0.15" />
      <path d="M6.5 7.5h4M6.5 10.5h4M6.5 13.5h2.5" strokeWidth="1.5" />
      <circle cx="15.5" cy="15.5" r="4" fill="currentColor" fillOpacity="0.2" />
      <path d="M18.4 18.4L21 21" strokeWidth="2.4" />
    </svg>
  );
}

/** Docket Peek power — a wide-open eye. */
export function PeekIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

/** Snap Election power — a lightning-fast ballot. */
export function SnapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="12" height="16" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M13 8l-4 5h2.6L10 18l5-6h-2.6L13 8z" fill="currentColor" stroke="none" />
      <path d="M17 6l3 3-3 3" transform="translate(0 6)" />
    </svg>
  );
}

/** Banish power — an exit door with an arrow (family-friendly, no death language). */
export function BanishIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h5" fill="currentColor" fillOpacity="0.15" />
      <path d="M13.5 8l4.5 4-4.5 4" />
      <path d="M18 12H9" />
    </svg>
  );
}

/** Veto — a shield with a hard X. */
export function VetoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l7 2.6v6c0 5-3 8.6-7 10.4-4-1.8-7-5.4-7-10.4v-6l7-2.6z" fill="currentColor" fillOpacity="0.18" />
      <path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4" strokeWidth="2.2" />
    </svg>
  );
}

/** Gridlock Meter — three fat pips, used at small sizes as a standalone glyph. */
export function GridlockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2" y="9" width="5.5" height="6" rx="1.2" />
      <rect x="9.2" y="9" width="5.5" height="6" rx="1.2" />
      <rect x="16.5" y="9" width="5.5" height="6" rx="1.2" />
    </svg>
  );
}

/** A decree scroll — used for the decree card back / track slots. */
export function DecreeScrollIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5h9a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H6" fill="currentColor" fillOpacity="0.12" />
      <path d="M6 3.5a2.5 2.5 0 0 0 0 5M6 15.5a2.5 2.5 0 0 0 0 5" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" strokeWidth="1.6" />
    </svg>
  );
}

/** Silhouette row for the huddle screen. */
export function SilhouetteIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4 21c0-5 3.6-8 8-8s8 3 8 8" />
    </svg>
  );
}

/** MERKY ANARCHY — an alert triangle, skewed for chaos. */
export function AnarchyIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l10.5 18h-21L12 2.5z" fill="currentColor" fillOpacity="0.22" />
      <path d="M12 9.5v5" strokeWidth="2.4" />
      <circle cx="12" cy="17.3" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Ballot box — used for the vote phase headers. */
export function BallotIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="9" width="18" height="12" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <path d="M8 13l4 4 4-6" strokeWidth="2.2" />
    </svg>
  );
}
