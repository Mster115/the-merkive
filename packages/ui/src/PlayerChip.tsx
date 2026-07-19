import * as React from "react";
import { cn } from "./cn";
import { avatarById } from "./avatars";
import { CrownIcon } from "./icons";

export function WhimsicalAvatarSVG({ id, color }: { id: string; color: string }) {
  return (
    <svg viewBox="0 0 32 32" className="w-[70%] h-[70%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {id === "fox" && (
        <g fill={color} stroke="#1e293b">
          <path d="M6 8l5 7h10l5-7-4 15H10L6 8z" />
          <circle cx="11" cy="16" r="1.5" fill="#1e293b" />
          <circle cx="21" cy="16" r="1.5" fill="#1e293b" />
          <polygon points="16,19 14,21 18,21" fill="#1e293b" />
        </g>
      )}
      {id === "frog" && (
        <g fill={color} stroke="#1e293b">
          <circle cx="9" cy="8" r="4" fill="#fff" />
          <circle cx="23" cy="8" r="4" fill="#fff" />
          <circle cx="9" cy="8" r="2" fill="#1e293b" />
          <circle cx="23" cy="8" r="2" fill="#1e293b" />
          <path d="M5 16c0-6 22-6 22 0v6H5v-6z" />
          <path d="M12 20q4 3 8 0" stroke="#1e293b" fill="none" />
        </g>
      )}
      {id === "cat" && (
        <g fill={color} stroke="#1e293b">
          <polygon points="5,6 10,13 5,18" />
          <polygon points="27,6 22,13 27,18" />
          <circle cx="16" cy="18" r="10" />
          <circle cx="12" cy="16" r="1.5" fill="#1e293b" />
          <circle cx="20" cy="16" r="1.5" fill="#1e293b" />
          <line x1="6" y1="18" x2="10" y2="18" />
          <line x1="26" y1="18" x2="22" y2="18" />
        </g>
      )}
      {id === "robot" && (
        <g fill={color} stroke="#1e293b">
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="3" />
          <circle cx="16" cy="2" r="2" fill="#ef4444" />
          <rect x="6" y="6" width="20" height="20" rx="4" />
          <circle cx="11" cy="14" r="3" fill="#fff" />
          <circle cx="21" cy="14" r="3" fill="#fff" />
          <circle cx="11" cy="14" r="1.5" fill="#1e293b" />
          <circle cx="21" cy="14" r="1.5" fill="#1e293b" />
          <rect x="10" y="21" width="12" height="2" rx="1" fill="#1e293b" />
        </g>
      )}
      {id === "ghost" && (
        <g stroke="#1e293b">
          <path d="M8 26c0-12 16-12 16 0 0 0-2 2-4 0s-2 2-4 0-2 2-4 0-2 2-4 0z" fill={color} />
          <circle cx="12" cy="15" r="2" fill="#1e293b" />
          <circle cx="20" cy="15" r="2" fill="#1e293b" />
        </g>
      )}
      {id === "dragon" && (
        <g fill={color} stroke="#1e293b">
          <polygon points="9,4 12,10 6,10" fill="#f59e0b" />
          <polygon points="23,4 26,10 20,10" fill="#f59e0b" />
          <circle cx="16" cy="18" r="10" />
          <circle cx="12" cy="16" r="2" fill="#1e293b" />
          <circle cx="20" cy="16" r="2" fill="#1e293b" />
        </g>
      )}
      {id === "alien" && (
        <g fill={color} stroke="#1e293b">
          <line x1="10" y1="3" x2="13" y2="9" />
          <line x1="22" y1="3" x2="19" y2="9" />
          <circle cx="10" cy="3" r="2" fill="#8aff5d" />
          <circle cx="22" cy="3" r="2" fill="#8aff5d" />
          <ellipse cx="16" cy="18" rx="10" ry="11" />
          <ellipse cx="11" cy="16" rx="3" ry="4" fill="#1e293b" />
          <ellipse cx="21" cy="16" rx="3" ry="4" fill="#1e293b" />
        </g>
      )}
      {id === "octopus" && (
        <g fill={color} stroke="#1e293b">
          <path d="M7 16C7 9 25 9 25 16c0 4-2 7-4 7s-3-2-5 0-3 2-5 0-4-3-4-7z" />
          <circle cx="12" cy="15" r="2" fill="#1e293b" />
          <circle cx="20" cy="15" r="2" fill="#1e293b" />
        </g>
      )}
      {id === "owl" && (
        <g fill={color} stroke="#1e293b">
          <circle cx="16" cy="17" r="10" />
          <circle cx="12" cy="14" r="3.5" fill="#fff" />
          <circle cx="20" cy="14" r="3.5" fill="#fff" />
          <circle cx="12" cy="14" r="1.5" fill="#1e293b" />
          <circle cx="20" cy="14" r="1.5" fill="#1e293b" />
          <polygon points="16,17 14,20 18,20" fill="#f59e0b" />
        </g>
      )}
      {id === "penguin" && (
        <g fill={color} stroke="#1e293b">
          <ellipse cx="16" cy="16" rx="10" ry="11" />
          <ellipse cx="16" cy="18" rx="6" ry="7" fill="#fff" />
          <circle cx="12" cy="13" r="1.5" fill="#1e293b" />
          <circle cx="20" cy="13" r="1.5" fill="#1e293b" />
          <polygon points="16,14 13,17 19,17" fill="#f59e0b" />
        </g>
      )}
      {id === "bee" && (
        <g fill={color} stroke="#1e293b">
          <ellipse cx="16" cy="17" rx="10" ry="9" />
          <line x1="6" y1="15" x2="26" y2="15" strokeWidth="3" stroke="#1e293b" />
          <line x1="8" y1="19" x2="24" y2="19" strokeWidth="3" stroke="#1e293b" />
          <circle cx="12" cy="12" r="1.5" fill="#1e293b" />
          <circle cx="20" cy="12" r="1.5" fill="#1e293b" />
          <ellipse cx="10" cy="6" rx="3" ry="5" fill="#e2e8f0" />
          <ellipse cx="22" cy="6" rx="3" ry="5" fill="#e2e8f0" />
        </g>
      )}
      {id === "crab" && (
        <g fill={color} stroke="#1e293b">
          <ellipse cx="16" cy="18" rx="10" ry="8" />
          <circle cx="7" cy="8" r="3" />
          <circle cx="25" cy="8" r="3" />
          <circle cx="12" cy="16" r="1.5" fill="#1e293b" />
          <circle cx="20" cy="16" r="1.5" fill="#1e293b" />
        </g>
      )}
      {id === "koala" && (
        <g fill={color} stroke="#1e293b">
          <circle cx="6" cy="10" r="4.5" fill="#e2e8f0" />
          <circle cx="26" cy="10" r="4.5" fill="#e2e8f0" />
          <circle cx="16" cy="18" r="10" />
          <circle cx="12" cy="16" r="1.5" fill="#1e293b" />
          <circle cx="20" cy="16" r="1.5" fill="#1e293b" />
          <ellipse cx="16" cy="19" rx="2.5" ry="3.5" fill="#1e293b" />
        </g>
      )}
      {id === "mushroom" && (
        <g stroke="#1e293b">
          <path d="M6 18c0-8 20-8 20 0z" fill={color} />
          <rect x="12" y="18" width="8" height="9" rx="3" fill="#f8fafc" />
          <circle cx="11" cy="13" r="2" fill="#fff" />
          <circle cx="21" cy="13" r="2" fill="#fff" />
          <circle cx="14" cy="22" r="1" fill="#1e293b" />
          <circle cx="18" cy="22" r="1" fill="#1e293b" />
        </g>
      )}
      {id === "dino" && (
        <g fill={color} stroke="#1e293b">
          <path d="M8 8c0-4 16-4 16 0v16H8V8z" />
          <circle cx="13" cy="12" r="1.5" fill="#1e293b" />
          <circle cx="21" cy="12" r="1.5" fill="#1e293b" />
          <path d="M12 18q4 3 8 0" fill="none" stroke="#1e293b" strokeWidth="2.5" />
        </g>
      )}
      {id === "rocket" && (
        <g stroke="#1e293b">
          <path d="M16 4c-5 0-8 6-8 15h16c0-9-3-15-8-15z" fill={color} />
          <circle cx="16" cy="13" r="3" fill="#38bdf8" />
          <polygon points="12,23 16,29 20,23" fill="#f59e0b" />
        </g>
      )}
      {!["fox", "frog", "cat", "robot", "ghost", "dragon", "alien", "octopus", "owl", "penguin", "bee", "crab", "koala", "mushroom", "dino", "rocket"].includes(id) && (
        <g fill={color} stroke="#1e293b">
          <circle cx="16" cy="16" r="11" />
          <circle cx="11" cy="13" r="3" fill="#fff" />
          <circle cx="21" cy="13" r="3" fill="#fff" />
          <circle cx="11" cy="13" r="1.5" fill="#1e293b" />
          <circle cx="21" cy="13" r="1.5" fill="#1e293b" />
          <path d="M11 21q5 4 10 0" fill="none" stroke="#1e293b" strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}

export function AvatarFace({
  avatarId,
  size = 40,
  className,
}: {
  avatarId: string;
  size?: number;
  className?: string;
}) {
  const a = avatarById(avatarId);
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
        background: `${a.color}40`,
      }}
    >
      <WhimsicalAvatarSVG id={a.id} color={a.color} />
    </span>
  );
}

export interface PlayerChipProps {
  displayName: string;
  avatarId: string;
  isHost?: boolean;
  connected?: boolean;
  abandoned?: boolean;
  highlight?: boolean;
  trailing?: React.ReactNode;
  size?: "md" | "lg";
  statusLabels?: { offline: string; abandoned: string; host: string };
}

const defaultLabels = { offline: "offline", abandoned: "left", host: "host" };

export function PlayerChip({
  displayName,
  avatarId,
  isHost,
  connected = true,
  abandoned,
  highlight,
  trailing,
  size = "md",
  statusLabels = defaultLabels,
}: PlayerChipProps) {
  const dim = abandoned || !connected;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 border-[3px] transition-all duration-300",
        "bg-[var(--mb-surface-2)] shadow-[var(--mb-shadow)]",
        size === "lg" ? "min-h-16 text-lg" : "min-h-12",
        highlight ? "border-[var(--mb-accent-2)] bg-[var(--mb-surface-3)]" : "border-black",
        dim && "opacity-55 saturate-50 shadow-none"
      )}
    >
      <span className="relative">
        <AvatarFace avatarId={avatarId} size={size === "lg" ? 44 : 34} />
        <span
          role="img"
          aria-label={abandoned ? statusLabels.abandoned : connected ? "online" : statusLabels.offline}
          className={cn(
            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black",
            abandoned ? "bg-[var(--mb-danger)]" : connected ? "bg-[var(--mb-ok)]" : "bg-[var(--mb-warn)]"
          )}
        />
      </span>
      <span className="font-bold truncate max-w-40">{displayName}</span>
      {isHost && (
        <span
          title={statusLabels.host}
          aria-label={statusLabels.host}
          className="text-[var(--mb-gold)] inline-flex items-center"
        >
          <CrownIcon className="w-4 h-4 fill-amber-400" />
        </span>
      )}
      {trailing != null && <span className="ml-auto pl-2">{trailing}</span>}
    </div>
  );
}
