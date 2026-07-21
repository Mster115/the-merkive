"use client";
import * as React from "react";
import { cn } from "./cn";
import { CloseIcon } from "./icons";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose?: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** aria-label for the built-in close button (pass a translated string). */
  closeLabel?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const node = ref.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab" && node) {
        const focusables = node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "mb-pop relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-[var(--mb-surface)] p-6 outline-none",
          "border-4 border-black shadow-[var(--mb-shadow-lg)]",
          className
        )}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="mb-press absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-md border-2 border-black bg-[var(--mb-surface-2)] text-[var(--mb-text)] shadow-[2px_2px_0_0_#000] hover:bg-[var(--mb-surface-3)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[var(--mb-violet)] focus-visible:outline-offset-2"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
        <h2 className="text-xl font-black uppercase mb-4 pr-10 [font-family:var(--mb-font-display)]">{title}</h2>
        {children}
      </div>
    </div>
  );
}
