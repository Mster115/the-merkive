"use client";
import * as React from "react";
import { cn } from "@merky/ui";

/** A ticker entry. `tone` tints the leading diamond to flag what kind of news it is. */
export interface TickerItem {
  text: string;
  tone?: "default" | "good" | "urgent";
}

const TONE_CLASS: Record<NonNullable<TickerItem["tone"]>, string> = {
  default: "bg-black",
  good: "bg-[var(--mb-accent)]",
  urgent: "bg-[var(--mb-danger)]",
};

function normalize(items: Array<TickerItem | string>): TickerItem[] {
  return items
    .map((i) => (typeof i === "string" ? { text: i } : i))
    .filter((i) => i.text.trim().length > 0);
}

/**
 * The global reduced-motion rule in tokens.css freezes every animation, which
 * for a marquee means the track stops at 0 and everything past the fold is
 * clipped away for good. That is fine for decoration but not for a strip whose
 * whole job is to carry information, so when motion is reduced we step through
 * the items on a timer instead of scrolling them.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function Entry({ item }: { item: TickerItem }) {
  return (
    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
      <span aria-hidden className={cn("w-2 h-2 rotate-45 shrink-0", TONE_CLASS[item.tone ?? "default"])} />
      {item.text}
    </span>
  );
}

/** Scrolling status ticker — the green marquee strip pinned to Home/Stage/Daily. */
export function Ticker({
  items,
  className,
}: {
  items: Array<TickerItem | string>;
  className?: string;
}) {
  const entries = normalize(items);
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!reduced || entries.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % entries.length), 4000);
    return () => clearInterval(id);
  }, [reduced, entries.length]);

  if (entries.length === 0) return null;

  // will-change + translateZ(0) promote the fixed strip to its own compositor
  // layer. Without it, iOS/WebKit defers repainting `position: fixed`
  // elements until a scroll gesture settles, so mid-scroll the strip visibly
  // lags behind and appears to float over whatever card the page has already
  // scrolled to underneath it, instead of staying pinned to the screen edge.
  const shell =
    "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-t-[3px] border-black pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] will-change-transform [transform:translateZ(0)]";

  if (reduced) {
    const item = entries[index % entries.length]!;
    return (
      <div className={cn(shell, "px-4 overflow-hidden", className)}>
        <Entry item={item} />
      </div>
    );
  }

  const row = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined} className="flex items-center gap-10 pr-10">
      {entries.map((item, i) => (
        <Entry key={i} item={item} />
      ))}
    </span>
  );

  return (
    <div className={cn("mb-marquee", shell, className)}>
      <div className="mb-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
