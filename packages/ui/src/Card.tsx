import * as React from "react";
import { cn } from "./cn";

export function Card({
  className,
  raised,
  glass,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean; glass?: boolean }) {
  return (
    <div
      suppressHydrationWarning
      className={cn(
        "rounded-lg bg-[var(--mb-surface)] p-5 border-[3px] border-black shadow-[var(--mb-shadow)]",
        raised && "border-4 shadow-[var(--mb-shadow-lg)]",
        // Glass is gone from this design language; the flag stays for API
        // compatibility and reads as a slightly lighter plate.
        glass && "bg-[var(--mb-surface-2)]",
        className
      )}
      {...rest}
    />
  );
}

export function Panel({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      suppressHydrationWarning
      className={cn(
        "rounded-md bg-[var(--mb-surface-2)] p-4 border-2 border-black",
        className
      )}
      {...rest}
    />
  );
}
