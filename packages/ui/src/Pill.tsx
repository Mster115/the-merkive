import * as React from "react";
import { cn } from "./cn";

export function Pill({
  tone = "neutral",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger" | "gold";
}) {
  const tones = {
    neutral: "bg-[var(--mb-surface-3)] text-[var(--mb-text)]",
    accent: "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]",
    ok: "bg-[var(--mb-ok)] text-[var(--mb-on-accent-2)]",
    warn: "bg-[var(--mb-warn)] text-[var(--mb-on-gold)]",
    danger: "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]",
    gold: "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border-2 border-black shadow-[2px_2px_0_0_#000]",
        "px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider",
        tones[tone],
        className
      )}
      {...rest}
    />
  );
}
