"use client";
import * as React from "react";
import { cn } from "@merky/ui";

/** Scrolling status ticker — the green marquee strip pinned to Home/Stage. */
export function Ticker({ items, className }: { items: string[]; className?: string }) {
  const row = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined} className="flex items-center gap-10 pr-10">
      {items.map((item, i) => (
        <span
          key={i}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"
        >
          <span aria-hidden className="w-2 h-2 bg-black rotate-45 shrink-0" />
          {item}
        </span>
      ))}
    </span>
  );
  return (
    <div
      className={cn(
        "mb-marquee bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-t-[3px] border-black py-2",
        className
      )}
    >
      <div className="mb-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
