import * as React from "react";
import { cn } from "./cn";
import { avatarById } from "./avatars";
import { WhimsicalAvatarSVG } from "./PlayerChip";

/**
 * Relocated from the eightstorm game folder (was a cross-game import from
 * zaplash). Kept as a distinct component from `AvatarFace`/`PlayerChip`
 * because its styling genuinely differs (solid vs. gradient background,
 * opacity-only dim state, unlocalized host label, etc.) — merging them would
 * change how eightstorm/zaplash render. Avatar art comes from the single
 * shared `WhimsicalAvatarSVG` set, so every surface draws the same faces;
 * unknown ids fall through to its generic-face fallback.
 */
export function WhimsicalAvatarFace({
  avatarId,
  size = 40,
  className,
}: {
  avatarId: string;
  size?: number;
  className?: string;
}) {
  const color = avatarById(avatarId).color;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-sm border-2 border-black shrink-0 relative overflow-hidden",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `${color}40`,
      }}
    >
      <WhimsicalAvatarSVG id={avatarId} color={color} />
    </span>
  );
}

export function WhimsicalPlayerChip({
  displayName,
  avatarId,
  isHost,
  connected = true,
  abandoned,
  highlight,
  trailing,
  size = "md",
}: {
  displayName: string;
  avatarId: string;
  isHost?: boolean;
  connected?: boolean;
  abandoned?: boolean;
  highlight?: boolean;
  trailing?: React.ReactNode;
  size?: "md" | "lg";
}) {
  const dim = abandoned || !connected;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 bg-[var(--mb-surface-2)] border-2",
        size === "lg" ? "min-h-16 text-lg" : "min-h-12",
        highlight ? "border-[var(--mb-accent-2)] shadow-[var(--mb-shadow)]" : "border-black",
        dim && "opacity-60"
      )}
    >
      <span className="relative">
        <WhimsicalAvatarFace avatarId={avatarId} size={size === "lg" ? 44 : 34} />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black",
            abandoned ? "bg-[var(--mb-danger)]" : connected ? "bg-[var(--mb-ok)]" : "bg-[var(--mb-warn)]"
          )}
        />
      </span>
      <span className="font-bold truncate max-w-40 text-white">{displayName}</span>
      {isHost && (
        <span title="Host" aria-label="Host" className="text-[var(--mb-gold)]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 18h14l1-11-4 3-4-6-4 6-4-3 1 11z" fill="var(--mb-gold, #f59e0b)" />
            <circle cx="5" cy="7" r="1.5" fill="#ffffff" />
            <circle cx="12" cy="4" r="1.5" fill="#ffffff" />
            <circle cx="19" cy="7" r="1.5" fill="#ffffff" />
          </svg>
        </span>
      )}
      {trailing != null && <span className="ml-auto pl-2">{trailing}</span>}
    </div>
  );
}
