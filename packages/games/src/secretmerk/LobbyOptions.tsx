"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { Panel, cn } from "@merky/ui";
import { SkullIcon } from "./icons";

export function SecretMerkLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const turnSeconds = typeof settings.turnSeconds === "number" ? settings.turnSeconds : 45;
  const hardcoreParanoia = Boolean(settings.hardcoreParanoia ?? false);
  const vetoPower = Boolean(settings.vetoPower ?? true);

  const toggleSetting = (key: string, currentValue: boolean) => {
    if (disabled) return;
    onChange({ [key]: !currentValue });
  };

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto select-none p-1">
      <div className="text-center mb-1">
        <h3 className="text-xl font-black text-[var(--mb-gold)] flex items-center justify-center gap-2 [font-family:var(--mb-font-display)] uppercase tracking-wider mb-neon-gold">
          <SkullIcon className="w-5 h-5 text-[var(--mb-danger)]" /> {t("games.secretmerk.name")} House Rules
        </h3>
        <p className="text-xs font-bold text-[var(--mb-text-dim)]">
          Customize presidential powers, turn timers, and secret role rules
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hardcore Paranoia Toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={hardcoreParanoia}
          onClick={() => toggleSetting("hardcoreParanoia", hardcoreParanoia)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-[3px] border-black flex items-center justify-between text-left focus-visible:outline-none mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none",
            hardcoreParanoia
              ? "bg-[var(--mb-danger)] text-white"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border-2 border-black bg-black text-[var(--mb-danger)] flex items-center justify-center font-black text-lg shrink-0 shadow-[2px_2px_0_0_#000]">
              <SkullIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]">
                Hardcore Paranoia
              </p>
              <span className="text-[0.65rem] font-bold opacity-90">
                Hide Merker identities in 5-player games
              </span>
            </div>
          </div>
          <span className={cn("text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]", hardcoreParanoia ? "bg-black text-[var(--mb-danger)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]")}>
            {hardcoreParanoia ? "ON" : "OFF"}
          </span>
        </button>

        {/* Veto Power Toggle */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={vetoPower}
          onClick={() => toggleSetting("vetoPower", vetoPower)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-[3px] border-black flex items-center justify-between text-left focus-visible:outline-none mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none",
            vetoPower
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border-2 border-black bg-black text-[var(--mb-accent-2)] flex items-center justify-center font-black text-lg shrink-0 shadow-[2px_2px_0_0_#000]">
              🚫
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]">
                Veto Power
              </p>
              <span className="text-[0.65rem] font-bold opacity-90">
                Allow Govt to reject all 3 Decrees after 5th Merker Law
              </span>
            </div>
          </div>
          <span className={cn("text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]", vetoPower ? "bg-black text-[var(--mb-accent-2)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]")}>
            {vetoPower ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* Turn Timer Selector */}
      <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-black text-sm text-white [font-family:var(--mb-font-display)] uppercase">
            Vote & Action Timer
          </p>
          <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
            Seconds to cast votes and discard decrees
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[30, 45, 60, 90].map((sec) => (
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
