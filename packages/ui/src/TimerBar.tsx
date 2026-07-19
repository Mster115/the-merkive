"use client";
import * as React from "react";
import { cn } from "./cn";
import { sfx } from "./sfx";

export interface TimerBarProps {
  endsAt: number;
  durationMs: number;
  now: number;
  label?: string;
  /** Play tick sounds in the final seconds (stage surfaces only). */
  sound?: boolean;
  className?: string;
}

export function TimerBar({ endsAt, durationMs, now, label, sound, className }: TimerBarProps) {
  const remaining = Math.max(0, endsAt - now);
  const pct = durationMs > 0 ? Math.min(100, (remaining / durationMs) * 100) : 0;
  const secs = Math.ceil(remaining / 1000);
  const urgent = secs <= 10 && remaining > 0;

  const lastTickRef = React.useRef(-1);
  React.useEffect(() => {
    if (!sound || !urgent || secs > 5 || secs <= 0) return;
    if (lastTickRef.current !== secs) {
      lastTickRef.current = secs;
      sfx.play("tick");
    }
  }, [sound, urgent, secs]);

  return (
    <div
      role="timer"
      aria-label={label ? `${label}: ${secs}s` : `${secs}s`}
      className={cn("flex items-center gap-3", className)}
    >
      <div className="relative flex-1 h-4 rounded-sm bg-[var(--mb-bg-2)] border-2 border-black overflow-hidden">
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-linear",
            urgent ? "bg-[var(--mb-danger)] mb-blink" : "bg-[var(--mb-accent-2)]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "font-black tabular-nums min-w-11 text-right [font-family:var(--mb-font-display)]",
          urgent ? "text-[var(--mb-danger)] text-lg mb-breathe" : "text-[var(--mb-text-dim)]"
        )}
      >
        {secs}s
      </span>
    </div>
  );
}
