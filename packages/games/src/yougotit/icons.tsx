import * as React from "react";

/** Team Bass — a few chunky, uneven low-frequency bars. */
export function BassIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2" y="9" width="4.4" height="10" rx="1.2" />
      <rect x="9.8" y="4" width="4.4" height="15" rx="1.2" />
      <rect x="17.6" y="7" width="4.4" height="12" rx="1.2" />
    </svg>
  );
}

/** Team Treble — many thin, arched high-frequency bars. */
export function TrebleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="1.2" y="13" width="2.6" height="6" rx="1" />
      <rect x="6" y="8" width="2.6" height="11" rx="1" />
      <rect x="10.7" y="3" width="2.6" height="16" rx="1" />
      <rect x="15.4" y="8" width="2.6" height="11" rx="1" />
      <rect x="20.2" y="13" width="2.6" height="6" rx="1" />
    </svg>
  );
}

/** The Oracle — a crystal ball with a swirl highlight on a stand. */
export function OracleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9.5" r="7" fill="currentColor" fillOpacity="0.18" />
      <path d="M8.3 7c.7-1.1 2.1-1.7 3.4-1.2" />
      <path d="M6.5 20h11" />
      <path d="M9 20c0-2.6 1.3-3.8 3-3.8s3 1.2 3 3.8" />
    </svg>
  );
}

/** The Undercut — crossing steal arrows. */
export function UndercutIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 17L17 3" />
      <path d="M11 3h6v6" />
      <path d="M21 7L7 21" />
      <path d="M13 21H7v-6" />
    </svg>
  );
}

/** Bullseye — used for the target-score setting and scoring badges. */
export function TargetIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.3" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Chunky chevron arrow for the big LEFT / RIGHT Undercut vote buttons. */
export function DirectionArrowIcon({
  dir,
  className = "w-8 h-8",
}: {
  dir: "left" | "right";
  className?: string;
}) {
  const points = dir === "left" ? "15,3 5,12 15,21" : "9,3 19,12 9,21";
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}

/** Four-point sparkle — flourish for "the Oracle is tuning in" moments. */
export function SparkleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}
