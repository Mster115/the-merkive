"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { ClockIcon, Panel, cn } from "@merky/ui";
import { OracleIcon, TargetIcon, UndercutIcon } from "./icons";

interface PackInfo {
  id: string;
  title?: string;
  titleKey?: string;
  nsfw?: boolean;
}

const TARGET_SCORES = ["7", "10", "15"] as const;
const GUESS_SECONDS_PRESETS = [30, 60, 90, 120, 150, 180];

export function YougotitLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const targetScore = typeof settings.targetScore === "string" ? settings.targetScore : "10";
  const stealEnabled = Boolean(settings.stealEnabled ?? true);
  const guessSeconds = typeof settings.guessSeconds === "number" ? settings.guessSeconds : 90;
  const packId = typeof settings.packId === "string" ? settings.packId : "yougotit-core";

  const [packs, setPacks] = React.useState<PackInfo[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/packs?gameId=yougotit")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: unknown) => {
        if (!cancelled && Array.isArray(list)) setPacks(list as PackInfo[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const packOptions: PackInfo[] = packs.length > 0 ? packs : [{ id: packId, title: packId }];

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto select-none p-1">
      <div className="text-center mb-1">
        <h3 className="text-xl font-black text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center justify-center gap-2 mb-neon-gold">
          <OracleIcon className="w-5 h-5 text-[var(--mb-gold)]" /> {t("games.yougotit.name")}
        </h3>
        <p className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
          {t("games.yougotit.lobby.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Points to win */}
        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-2 col-span-1 sm:col-span-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
            <TargetIcon className="w-4 h-4 text-[var(--mb-gold)]" />
            {t("games.yougotit.settings.targetScore")}
          </span>
          <div className="flex items-center gap-1.5">
            {TARGET_SCORES.map((score) => (
              <button
                key={score}
                type="button"
                disabled={disabled}
                aria-pressed={targetScore === score}
                onClick={() => !disabled && onChange({ targetScore: score })}
                className={cn(
                  "min-w-[52px] min-h-[44px] px-2 rounded-lg text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-gold)] [font-family:var(--mb-font-display)]",
                  targetScore === score
                    ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                    : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                )}
              >
                {score}
              </button>
            ))}
          </div>
        </Panel>

        {/* The Undercut toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={stealEnabled}
          onClick={() => !disabled && onChange({ stealEnabled: !stealEnabled })}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-[3px] border-black flex items-center justify-between text-left col-span-1 sm:col-span-2 mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-danger)]",
            stealEnabled
              ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]",
                stealEnabled ? "bg-[var(--mb-paper)] text-[var(--mb-ink)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]"
              )}
            >
              <UndercutIcon className="w-6 h-6 text-current" />
            </div>
            <div>
              <p
                className={cn(
                  "font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]",
                  stealEnabled ? "text-[var(--mb-on-danger)]" : "text-white"
                )}
              >
                {t("games.yougotit.settings.stealEnabled")}
              </p>
              <span
                className={cn(
                  "text-xs font-bold",
                  stealEnabled ? "text-[var(--mb-on-danger)]/80" : "text-[var(--mb-text-dim)]"
                )}
              >
                {t("games.yougotit.settings.stealEnabledHint")}
              </span>
            </div>
          </div>
          <span
            className={cn(
              "text-lg font-black shrink-0 ml-2 uppercase [font-family:var(--mb-font-display)]",
              stealEnabled ? "text-[var(--mb-on-danger)]" : "text-[var(--mb-text-dim)]"
            )}
          >
            {stealEnabled ? t("games.yougotit.ui.on") : t("games.yougotit.ui.off")}
          </span>
        </button>

        {/* Guessing time */}
        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-2 col-span-1 sm:col-span-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1.5">
            <ClockIcon className="w-4 h-4 text-[var(--mb-accent-2)]" />
            {t("games.yougotit.settings.guessSeconds")}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {GUESS_SECONDS_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                aria-pressed={guessSeconds === s}
                onClick={() => !disabled && onChange({ guessSeconds: s })}
                className={cn(
                  "min-w-[44px] min-h-[44px] rounded-lg text-xs font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent-2)] [font-family:var(--mb-font-display)]",
                  guessSeconds === s
                    ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
                    : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                )}
              >
                {s}s
              </button>
            ))}
          </div>
        </Panel>

        {/* Content Pack Picker */}
        <div className="col-span-1 sm:col-span-2 p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
          <label className="text-xs font-black text-[var(--mb-text-dim)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.yougotit.settings.packId")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {packOptions.map((p) => {
              const isSelected = packId === p.id;
              const label = p.titleKey ? t(p.titleKey) : p.title ?? p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  onClick={() => !disabled && onChange({ packId: p.id })}
                  className={cn(
                    "p-3.5 min-h-[52px] rounded-xl border-2 border-black text-left font-black mb-press shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2",
                    p.nsfw ? "focus-visible:ring-[var(--mb-pink)]" : "focus-visible:ring-[var(--mb-accent-2)]",
                    isSelected
                      ? p.nsfw
                        ? "bg-[var(--mb-pink)] text-[var(--mb-on-pink)]"
                        : "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
                      : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                  )}
                >
                  <p className="text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]">{label}</p>
                  {p.nsfw && <span className="text-xs font-bold opacity-90">18+</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-[0.65rem] font-bold text-[var(--mb-text-dim)] opacity-80 mt-1">
        {t("games.yougotit.credits")}
      </p>
    </div>
  );
}
