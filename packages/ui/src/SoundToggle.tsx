"use client";
import * as React from "react";
import { cn } from "./cn";
import { sfx } from "./sfx";
import { SpeakerOffIcon, SpeakerOnIcon } from "./icons";

/** Mute/unmute for the synthesized sound kit (stage surfaces). */
export function SoundToggle({ className, labels }: { className?: string; labels?: { on: string; off: string } }) {
  const [muted, setMuted] = React.useState(true);
  const l = labels ?? { on: "Sound on", off: "Sound off" };
  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? l.off : l.on}
      title={muted ? l.off : l.on}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        sfx.setMuted(next);
        if (!next) sfx.play("pop");
      }}
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
