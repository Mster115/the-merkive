"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { Panel, cn } from "@merky/ui";
import { LightningIcon, ReverseIcon, SkipIcon, StarIcon } from "./icons";

export function EightstormLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const drawTwoOnTwo = Boolean(settings.drawTwoOnTwo ?? true);
  const skipOnJack = Boolean(settings.skipOnJack ?? true);
  const reverseOnAce = Boolean(settings.reverseOnAce ?? true);
  const jokers = Boolean(settings.jokers ?? false);
  const turnSeconds = typeof settings.turnSeconds === "number" ? settings.turnSeconds : 45;

  const toggleSetting = (key: string, currentValue: boolean) => {
    if (disabled) return;
    onChange({ [key]: !currentValue });
  };

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto select-none p-1">
      <div className="text-center mb-1">
        <h3 className="text-xl font-black text-[var(--mb-gold)] flex items-center justify-center gap-2 [font-family:var(--mb-font-display)] uppercase italic mb-neon-gold">
          <LightningIcon className="w-5 h-5 text-[var(--mb-gold)]" /> {t("games.eightstorm.name")} House Rules
        </h3>
        <p className="text-xs font-bold text-[var(--mb-text-dim)]">
          Customize action card powers & turn rules
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Stack +2s */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={drawTwoOnTwo}
          onClick={() => toggleSetting("drawTwoOnTwo", drawTwoOnTwo)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-2 border-black flex items-center justify-between transition-all text-left focus-visible:outline-none mb-press",
            drawTwoOnTwo
              ? "bg-[var(--mb-surface-3)] shadow-[var(--mb-shadow)]"
              : "bg-[var(--mb-surface)] border-black opacity-60 shadow-none"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-14 rounded-lg border-2 border-black bg-[var(--mb-gold)] text-[var(--mb-on-gold)] flex flex-col items-center justify-center font-black text-sm p-1 shrink-0 shadow-[2px_2px_0_0_#000]">
              <LightningIcon className="w-4 h-4 text-[var(--mb-on-gold)]" />
              <span className="text-[0.6rem] uppercase tracking-tighter [font-family:var(--mb-font-display)]">+2</span>
            </div>
            <div>
              <p className="font-extrabold text-sm text-[var(--mb-text)]">
                Stack +2 Cards
              </p>
              <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
                Chain +2 draw penalties
              </span>
            </div>
          </div>
          <span className={cn(
            "text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]",
            drawTwoOnTwo
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)]"
          )}>
            {drawTwoOnTwo ? "ON" : "OFF"}
          </span>
        </button>

        {/* Skip Cards */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={skipOnJack}
          onClick={() => toggleSetting("skipOnJack", skipOnJack)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-2 border-black flex items-center justify-between transition-all text-left focus-visible:outline-none mb-press",
            skipOnJack
              ? "bg-[var(--mb-surface-3)] shadow-[var(--mb-shadow)]"
              : "bg-[var(--mb-surface)] border-black opacity-60 shadow-none"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-14 rounded-lg border-2 border-black bg-[var(--mb-pink)] text-[var(--mb-on-pink)] flex flex-col items-center justify-center font-black text-sm p-1 shrink-0 shadow-[2px_2px_0_0_#000]">
              <SkipIcon className="w-4 h-4 text-[var(--mb-on-pink)]" />
              <span className="text-[0.55rem] uppercase tracking-tighter [font-family:var(--mb-font-display)]">SKIP</span>
            </div>
            <div>
              <p className="font-extrabold text-sm text-[var(--mb-text)]">
                Skip Action Cards
              </p>
              <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
                Skip next player's turn
              </span>
            </div>
          </div>
          <span className={cn(
            "text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]",
            skipOnJack
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)]"
          )}>
            {skipOnJack ? "ON" : "OFF"}
          </span>
        </button>

        {/* Reverse Cards */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={reverseOnAce}
          onClick={() => toggleSetting("reverseOnAce", reverseOnAce)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-2 border-black flex items-center justify-between transition-all text-left focus-visible:outline-none mb-press",
            reverseOnAce
              ? "bg-[var(--mb-surface-3)] shadow-[var(--mb-shadow)]"
              : "bg-[var(--mb-surface)] border-black opacity-60 shadow-none"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-14 rounded-lg border-2 border-black bg-[var(--mb-violet)] text-[var(--mb-ink)] flex flex-col items-center justify-center font-black text-sm p-1 shrink-0 shadow-[2px_2px_0_0_#000]">
              <ReverseIcon className="w-4 h-4 text-[var(--mb-ink)]" />
              <span className="text-[0.55rem] uppercase tracking-tighter [font-family:var(--mb-font-display)]">REV</span>
            </div>
            <div>
              <p className="font-extrabold text-sm text-[var(--mb-text)]">
                Reverse Action Cards
              </p>
              <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
                Flip table turn direction
              </span>
            </div>
          </div>
          <span className={cn(
            "text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]",
            reverseOnAce
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)]"
          )}>
            {reverseOnAce ? "ON" : "OFF"}
          </span>
        </button>

        {/* Jokers (extra wilds) */}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={jokers}
          onClick={() => toggleSetting("jokers", jokers)}
          className={cn(
            "p-4 min-h-[64px] rounded-xl border-2 border-black flex items-center justify-between transition-all text-left focus-visible:outline-none mb-press",
            jokers
              ? "bg-[var(--mb-surface-3)] shadow-[var(--mb-shadow)]"
              : "bg-[var(--mb-surface)] border-black opacity-60 shadow-none"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-14 rounded-lg border-2 border-black bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] flex flex-col items-center justify-center font-black text-sm p-1 shrink-0 shadow-[2px_2px_0_0_#000]">
              <StarIcon className="w-4 h-4 text-[var(--mb-on-accent-2)]" />
              <span className="text-[0.55rem] uppercase tracking-tighter [font-family:var(--mb-font-display)]">WILD</span>
            </div>
            <div>
              <p className="font-extrabold text-sm text-[var(--mb-text)]">{t("games.eightstorm.settings.jokers")}</p>
              <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
                {t("games.eightstorm.settings.jokersHint")}
              </span>
            </div>
          </div>
          <span className={cn(
            "text-xs font-black shrink-0 ml-2 px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0_0_#000]",
            jokers
              ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
              : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)]"
          )}>
            {jokers ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* Turn Timer Selector */}
      <Panel className="p-4 rounded-xl bg-[var(--mb-surface)] border-2 border-black shadow-[var(--mb-shadow)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-black text-sm text-[var(--mb-text)] [font-family:var(--mb-font-display)] uppercase">
            {t("games.eightstorm.settings.turnSeconds")}
          </p>
          <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)]">
            Auto-draw/pass when timer expires
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[15, 30, 45, 60].map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={disabled}
              aria-pressed={turnSeconds === sec}
              onClick={() => onChange({ turnSeconds: sec })}
              className={cn(
                "min-w-[44px] min-h-[44px] rounded-lg text-xs font-black transition-all flex items-center justify-center border-2 border-black focus-visible:outline-none mb-press",
                turnSeconds === sec
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)] shadow-[2px_2px_0_0_#000]"
                  : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] hover:text-white"
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
