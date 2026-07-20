"use client";
import * as React from "react";
import { cn } from "./cn";
import { buzz } from "./haptics";
import { sfx } from "./sfx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "lg" | "md" | "sm";

const slab =
  "border-[3px] border-black shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none";

const variants: Record<Variant, string> = {
  primary: cn("text-[var(--mb-on-accent)] bg-[var(--mb-accent)]", slab),
  secondary: cn("text-[var(--mb-on-accent-2)] bg-[var(--mb-accent-2)]", slab),
  gold: cn("text-[var(--mb-on-gold)] bg-[var(--mb-gold)]", slab),
  danger: cn("text-[var(--mb-on-danger)] bg-[var(--mb-danger)]", slab),
  ghost:
    "bg-[var(--mb-surface-2)] border-[3px] border-black text-[var(--mb-text)] hover:border-[var(--mb-line-bright)] active:translate-x-0.5 active:translate-y-0.5",
};

const sizes: Record<Size, string> = {
  lg: "min-h-14 px-7 text-xl rounded-lg",
  md: "min-h-12 px-5 text-base rounded-md",
  sm: "min-h-11 px-4 text-sm rounded-md",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Skip the built-in tap haptic/click. */
  silent?: boolean;
  /** Disable diagonal shine overlay on hover. */
  noShine?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  silent,
  noShine = false,
  className,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  const disableShine = noShine || variant === "secondary";

  return (
    <button
      type={type}
      onClick={(e) => {
        if (!silent) {
          buzz(10);
          sfx.play("click");
        }
        onClick?.(e);
      }}
      className={cn(
        !disableShine && "mb-shine",
        "inline-flex items-center justify-center gap-2 font-black uppercase tracking-wide select-none",
        "transition-all duration-100 will-change-transform hover:brightness-105",
        "disabled:opacity-40 disabled:saturate-50 disabled:pointer-events-none",
        "focus-visible:outline-4 focus-visible:outline-[var(--mb-violet)] focus-visible:outline-offset-2",
        "[font-family:var(--mb-font-display)]",
        variants[variant],
        sizes[size],
        block && "w-full",
        className
      )}
      {...rest}
    />
  );
}
