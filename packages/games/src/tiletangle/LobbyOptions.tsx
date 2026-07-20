"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { Panel, cn } from "@merky/ui";

export function PuzzleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049-.322.059-.648.289-.878l1.564-1.564a2.121 2.121 0 0 0-3-3l-1.564 1.564c-.23.23-.556.338-.878.289a2.121 2.121 0 0 0-2.07 3.376l-1.477 1.477a2.12 2.12 0 0 0-3.376-2.07c-.322-.049-.648.059-.878.289L6.464 5.439a2.121 2.121 0 0 0-3 3l1.564 1.564c.23.23.338.556.289.878a2.121 2.121 0 0 0 3.376 2.07l1.477 1.477a2.12 2.12 0 0 0-2.07 3.376c-.049.322.059.648.289.878l1.564 1.564a2.121 2.121 0 0 0 3-3l-1.564-1.564c-.23-.23-.556-.338-.878-.289a2.121 2.121 0 0 0-2.07-3.376l1.477-1.477a2.12 2.12 0 0 0 3.376 2.07c.322.049.648-.059.878-.289l1.564-1.564a2.121 2.121 0 0 0 0-3l-1.564-1.564a.82.82 0 0 1-.289-.878 2.121 2.121 0 0 0 2.07-3.376z" />
    </svg>
  );
}

export function TileTangleLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const turnSeconds = typeof settings.turnSeconds === "number" ? settings.turnSeconds : 90;
  const initialMeldPoints = typeof settings.initialMeldPoints === "number" ? settings.initialMeldPoints : 30;
  const extraJokers = Boolean(settings.extraJokers ?? false);
  const freeDrawOnPass = Boolean(settings.freeDrawOnPass ?? true);

  const toggleSetting = (key: string, currentValue: boolean) => {
    if (disabled) return;
    onChange({ [key]: !currentValue });
  };

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto select-none p-1">
      <div className="text-center mb-1">
        <h3 className="text-xl font-black text-[var(--mb-gold)] flex items-center justify-center gap-2 [font-family:var(--mb-font-display)] uppercase tracking-wider mb-neon-gold">
          <PuzzleIcon className="w-5 h-5 text-[var(--mb-gold)]" /> {t("games.tiletangle.name")} House Rules
        </h3>
        <p className="text-xs font-bold text-[var(--mb-text-dim)]">
          Customize meld thresholds, turn timers, and wild tiles
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Extra Jokers Toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={extraJokers}
          onClick={() => toggleSetting("extraJokers", extraJokers)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-[3px] border-black flex items-center justify-between text-left focus-visible:outline-none mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none",
            extraJokers
              ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border-2 border-black bg-black text-[var(--mb-gold)] flex items-center justify-center font-black text-lg shrink-0 shadow-[2px_2px_0_0_#000]">
              ★
            </div>
            <div>
              <p className={cn("font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]", extraJokers ? "text-[var(--mb-on-gold)]" : "text-white")}>
                Extra Wild Jokers
              </p>
              <span className={cn("text-[0.65rem] font-bold", extraJokers ? "text-[var(--mb-on-gold)]/80" : "text-[var(--mb-text-dim)]")}>
                Add 4 Jokers to the tile bag
              </span>
            </div>
          </div>
          <span className={cn("text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]", extraJokers ? "bg-black text-[var(--mb-gold)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]")}>
            {extraJokers ? "4 WILD" : "2 WILD"}
          </span>
        </button>

        {/* Free Draw on Pass Toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={freeDrawOnPass}
          onClick={() => toggleSetting("freeDrawOnPass", freeDrawOnPass)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-[3px] border-black flex items-center justify-between text-left focus-visible:outline-none mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none",
            freeDrawOnPass
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border-2 border-black bg-black text-[var(--mb-accent-2)] flex items-center justify-center font-black text-lg shrink-0 shadow-[2px_2px_0_0_#000]">
              +1
            </div>
            <div>
              <p className={cn("font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]", freeDrawOnPass ? "text-[var(--mb-on-accent-2)]" : "text-white")}>
                Auto-Draw on Pass
              </p>
              <span className={cn("text-[0.65rem] font-bold", freeDrawOnPass ? "text-[var(--mb-on-accent-2)]/80" : "text-[var(--mb-text-dim)]")}>
                Draw a tile automatically if no tiles played
              </span>
            </div>
          </div>
          <span className={cn("text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]", freeDrawOnPass ? "bg-black text-[var(--mb-accent-2)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]")}>
            {freeDrawOnPass ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* Initial Meld Requirement Selector */}
      <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-black text-sm text-white [font-family:var(--mb-font-display)] uppercase">
            Initial Meld Requirement
          </p>
          <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
            Min points required to lay down first set
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[20, 25, 30, 35, 40].map((pts) => (
            <button
              key={pts}
              type="button"
              disabled={disabled}
              aria-pressed={initialMeldPoints === pts}
              onClick={() => onChange({ initialMeldPoints: pts })}
              className={cn(
                "min-w-[42px] min-h-[42px] rounded-lg text-xs font-black transition-all flex items-center justify-center border-2 border-black focus-visible:outline-none mb-press",
                initialMeldPoints === pts
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)] shadow-[2px_2px_0_0_#000]"
                  : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              {pts}p
            </button>
          ))}
        </div>
      </Panel>

      {/* Turn Duration Selector */}
      <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-black text-sm text-white [font-family:var(--mb-font-display)] uppercase">
            Turn Duration
          </p>
          <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
            Seconds per turn before turn passes
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[30, 60, 90, 120, 180].map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={disabled}
              aria-pressed={turnSeconds === sec}
              onClick={() => onChange({ turnSeconds: sec })}
              className={cn(
                "min-w-[42px] min-h-[42px] rounded-lg text-xs font-black transition-all flex items-center justify-center border-2 border-black focus-visible:outline-none mb-press",
                turnSeconds === sec
                  ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)] shadow-[2px_2px_0_0_#000]"
                  : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              {sec}s
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
