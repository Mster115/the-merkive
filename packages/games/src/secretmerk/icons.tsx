import * as React from "react";

export function CrownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 18h14l1-11-4 3-4-6-4 6-4-3 1 11z" />
    </svg>
  );
}

export function ShieldIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--mb-gold)" fillOpacity="0.2" />
    </svg>
  );
}

export function SkullIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 22h6v-2H9v2zm3-20A7 7 0 0 0 5 9c0 2.8 1.6 5.2 4 6.3V18h6v-2.7c2.4-1.1 4-3.5 4-6.3a7 7 0 0 0-7-7z" fill="var(--mb-danger)" fillOpacity="0.25" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GavelIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 13 5 5c.6.6.6 1.4 0 2l-1 1c-.6.6-1.4.6-2 0l-5-5" />
      <path d="m16 11 2.5-2.5c.8-.8.8-2 0-2.8l-2.7-2.7c-.8-.8-2-.8-2.8 0L10.5 5.5" />
      <path d="m4 13 5.5-5.5" />
      <path d="M2 21h10" strokeWidth="2.5" />
    </svg>
  );
}

export function EyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="var(--mb-accent-2)" fillOpacity="0.2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TargetIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
