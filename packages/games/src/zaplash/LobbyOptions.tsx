"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { Panel, cn } from "@merky/ui";

export function ZapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function ClockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

interface PackInfo {
  id: string;
  title?: string;
  titleKey?: string;
  nsfw?: boolean;
}

export function ZaplashLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const rounds = typeof settings.rounds === "number" ? settings.rounds : 2;
  const writeSeconds = typeof settings.writeSeconds === "number" ? settings.writeSeconds : 90;
  const zapBonus = Boolean(settings.zapBonus ?? true);
  const lightningRound = Boolean(settings.lightningRound ?? true);
  const packId = typeof settings.packId === "string" ? settings.packId : "zaplash-core";

  const [packs, setPacks] = React.useState<PackInfo[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/packs?gameId=zaplash")
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
        <h3 className="text-xl font-black text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center justify-center gap-2">
          <ZapIcon className="w-5 h-5 text-[var(--mb-gold)]" /> {t("games.zaplash.name")} Settings
        </h3>
        <p className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
          Customize rounds, timing, and prompt packs
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ZAP! Bonus Toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={zapBonus}
          onClick={() => !disabled && onChange({ zapBonus: !zapBonus })}
          className={cn(
            "p-4 min-h-[56px] rounded-xl border-[3px] border-black flex items-center justify-between text-left col-span-1 sm:col-span-2 mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-gold)]",
            zapBonus
              ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]",
                zapBonus ? "bg-[var(--mb-paper)] text-[var(--mb-ink)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]"
              )}
            >
              <ZapIcon className="w-6 h-6 text-current" />
            </div>
            <div>
              <p className={cn("font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]", zapBonus ? "text-[var(--mb-on-gold)]" : "text-white")}>
                {t("games.zaplash.settings.zapBonus")}
              </p>
              <span className={cn("text-xs font-bold", zapBonus ? "text-[var(--mb-on-gold)]/80" : "text-[var(--mb-text-dim)]")}>
                Unanimous vote sweep yields +50 bonus pts
              </span>
            </div>
          </div>
          <span className={cn("text-lg font-black shrink-0 ml-2 uppercase [font-family:var(--mb-font-display)]", zapBonus ? "text-[var(--mb-on-gold)]" : "text-[var(--mb-text-dim)]")}>
            {zapBonus ? "ON" : "OFF"}
          </span>
        </button>

        {/* Lightning Round Finale Toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={lightningRound}
          onClick={() => !disabled && onChange({ lightningRound: !lightningRound })}
          className={cn(
            "p-4 min-h-[56px] rounded-xl border-[3px] border-black flex items-center justify-between text-left col-span-1 sm:col-span-2 mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-pink)]",
            lightningRound
              ? "bg-[var(--mb-pink)] text-[var(--mb-on-pink)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]",
                lightningRound ? "bg-[var(--mb-paper)] text-[var(--mb-ink)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]"
              )}
            >
              <ZapIcon className="w-6 h-6 text-current" />
            </div>
            <div>
              <p className={cn("font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]", lightningRound ? "text-[var(--mb-on-pink)]" : "text-white")}>
                {t("games.zaplash.settings.lightningRound")}
              </p>
              <span className={cn("text-xs font-bold", lightningRound ? "text-[var(--mb-on-pink)]/80" : "text-[var(--mb-text-dim)]")}>
                One shared prompt, everyone votes, big bonus points
              </span>
            </div>
          </div>
          <span className={cn("text-lg font-black shrink-0 ml-2 uppercase [font-family:var(--mb-font-display)]", lightningRound ? "text-[var(--mb-on-pink)]" : "text-[var(--mb-text-dim)]")}>
            {lightningRound ? "ON" : "OFF"}
          </span>
        </button>

        {/* Content Pack Picker */}
        <div className="col-span-1 sm:col-span-2 p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
          <label className="text-xs font-black text-[var(--mb-text-dim)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.zaplash.settings.packId")}
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

        {/* Rounds */}
        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.zaplash.settings.rounds")}
          </span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((r) => (
              <button
                key={r}
                type="button"
                disabled={disabled}
                aria-pressed={rounds === r}
                onClick={() => !disabled && onChange({ rounds: r })}
                className={cn(
                  "min-w-[44px] min-h-[44px] rounded-lg text-xs font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent)] [font-family:var(--mb-font-display)]",
                  rounds === r
                    ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                    : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </Panel>

        {/* Writing Seconds */}
        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5 text-[var(--mb-accent-2)]" />
            Write Time
          </span>
          <div className="flex items-center gap-1.5">
            {[60, 90, 120].map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                aria-pressed={writeSeconds === s}
                onClick={() => !disabled && onChange({ writeSeconds: s })}
                className={cn(
                  "min-w-[44px] min-h-[44px] rounded-lg text-xs font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent)] [font-family:var(--mb-font-display)]",
                  writeSeconds === s
                    ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                    : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                )}
              >
                {s}s
              </button>
            ))}
          </div>
        </Panel>

        {/* Voting Seconds */}
        <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5 text-[var(--mb-pink)]" />
            Vote Time
          </span>
          <div className="flex items-center gap-1.5">
            {[15, 25, 40].map((s) => {
              const voteSeconds = typeof settings.voteSeconds === "number" ? settings.voteSeconds : 25;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  aria-pressed={voteSeconds === s}
                  onClick={() => !disabled && onChange({ voteSeconds: s })}
                  className={cn(
                    "min-w-[44px] min-h-[44px] rounded-lg text-xs font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-pink)] [font-family:var(--mb-font-display)]",
                    voteSeconds === s
                      ? "bg-[var(--mb-pink)] text-[var(--mb-on-pink)]"
                      : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
                  )}
                >
                  {s}s
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
