"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { ClockIcon, Panel, Pill, cn } from "@merky/ui";

const ROUND_COUNTS = [3, 6, 9] as const;
const ANSWER_TIMES = [15, 30, 45, 60] as const;
const VOTE_TIMES = [10, 20, 30, 45] as const;
const DRAW_TIMES = [30, 60, 90, 120] as const;
const GUESS_TIMES = [10, 25, 35, 45] as const;

export function MerkadeLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const roundCount = typeof settings.roundCount === "number" ? settings.roundCount : 6;
  const answerSeconds = typeof settings.answerSeconds === "number" ? settings.answerSeconds : 30;
  const voteSeconds = typeof settings.voteSeconds === "number" ? settings.voteSeconds : 20;
  const drawSeconds = typeof settings.drawSeconds === "number" ? settings.drawSeconds : 60;
  const guessSeconds = typeof settings.guessSeconds === "number" ? settings.guessSeconds : 25;

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto select-none p-1">
      <div className="text-center mb-1">
        <h3 className="text-xl font-black text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center justify-center gap-2 mb-neon-gold">
          {t("games.merkade.name")}
        </h3>
        <p className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
          {t("games.merkade.tagline")}
        </p>
      </div>

      {/* Round Count */}
      <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
        <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
          {t("games.merkade.settings.roundCount")}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {ROUND_COUNTS.map((rc) => (
            <button
              key={rc}
              type="button"
              disabled={disabled}
              aria-pressed={roundCount === rc}
              onClick={() => !disabled && onChange({ roundCount: rc })}
              className={cn(
                "min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-gold)] [font-family:var(--mb-font-display)] uppercase text-center leading-tight",
                roundCount === rc
                  ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                  : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              {t("games.merkade.ui.rounds_unit", { count: rc })}
            </button>
          ))}
        </div>
      </Panel>

      {/* Answer Seconds */}
      <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
        <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
          <ClockIcon className="w-4 h-4 text-[var(--mb-accent)]" />
          {t("games.merkade.settings.answerSeconds")}
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {ANSWER_TIMES.map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={disabled}
              aria-pressed={answerSeconds === sec}
              onClick={() => !disabled && onChange({ answerSeconds: sec })}
              className={cn(
                "min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-gold)] [font-family:var(--mb-font-display)] uppercase text-center leading-tight",
                answerSeconds === sec
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                  : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              {t("games.merkade.ui.seconds_unit", { sec })}
            </button>
          ))}
        </div>
      </Panel>

      {/* Draw Seconds */}
      <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
        <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
          <ClockIcon className="w-4 h-4 text-[var(--mb-pink)]" />
          {t("games.merkade.settings.drawSeconds")}
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {DRAW_TIMES.map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={disabled}
              aria-pressed={drawSeconds === sec}
              onClick={() => !disabled && onChange({ drawSeconds: sec })}
              className={cn(
                "min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-gold)] [font-family:var(--mb-font-display)] uppercase text-center leading-tight",
                drawSeconds === sec
                  ? "bg-[var(--mb-pink)] text-[var(--mb-on-pink)]"
                  : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              {t("games.merkade.ui.seconds_unit", { sec })}
            </button>
          ))}
        </div>
      </Panel>

      {/* Vote & Guess Seconds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.merkade.settings.voteSeconds")}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {VOTE_TIMES.map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={disabled}
                aria-pressed={voteSeconds === sec}
                onClick={() => !disabled && onChange({ voteSeconds: sec })}
                className={cn(
                  "min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press [font-family:var(--mb-font-display)] uppercase",
                  voteSeconds === sec
                    ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                    : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                )}
              >
                {t("games.merkade.ui.seconds_unit", { sec })}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.merkade.settings.guessSeconds")}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {GUESS_TIMES.map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={disabled}
                aria-pressed={guessSeconds === sec}
                onClick={() => !disabled && onChange({ guessSeconds: sec })}
                className={cn(
                  "min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press [font-family:var(--mb-font-display)] uppercase",
                  guessSeconds === sec
                    ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                    : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                )}
              >
                {t("games.merkade.ui.seconds_unit", { sec })}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
