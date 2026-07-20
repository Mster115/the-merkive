"use client";
import * as React from "react";
import { cn } from "./cn";
import { sfx } from "./sfx";
import { bgm } from "./bgm";
import { SpeakerOffIcon, SpeakerOnIcon } from "./icons";

const STORAGE_KEY = "mb_sound_muted";

function getInitialMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // ignore
  }
  return sfx.isMuted() && bgm.isMuted();
}

/** Mute/unmute for sound effects and background music. */
export function SoundToggle({ className, labels }: { className?: string; labels?: { on: string; off: string } }) {
  const [muted, setMutedState] = React.useState(getInitialMuted);

  React.useEffect(() => {
    // Sync initial state with engines
    sfx.setMuted(muted);
    bgm.setMuted(muted);

    const unsub = bgm.subscribe((m) => {
      setMutedState(m);
    });
    return unsub;
  }, []);

  const toggle = React.useCallback(() => {
    const next = !muted;
    setMutedState(next);
    sfx.setMuted(next);
    bgm.setMuted(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
    } catch {
      // ignore
    }
    if (!next) sfx.play("pop");
  }, [muted]);

  const l = labels ?? { on: "Sound on", off: "Sound off" };
  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? l.off : l.on}
      title={muted ? l.off : l.on}
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center w-11 h-11 rounded-md",
        "bg-[var(--mb-surface-2)] border-2 border-black shadow-[2px_2px_0_0_#000]",
        "active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all",
        className
      )}
    >
      {muted ? <SpeakerOffIcon className="w-5 h-5" /> : <SpeakerOnIcon className="w-5 h-5" />}
    </button>
  );
}
