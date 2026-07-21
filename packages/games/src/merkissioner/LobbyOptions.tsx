"use client";

import * as React from "react";
import type { LobbyOptionsProps } from "@merky/game-sdk";
import { ClockIcon, Panel, Pill, cn } from "@merky/ui";
import { BallotIcon, BossIcon } from "./icons";
import { roleCountsFor } from "./roles";

const PACES = ["relaxed", "standard", "speedy"] as const;
const PLAYER_COUNTS = [5, 6, 7, 8] as const;

export function MerkissionerLobbyOptions({ settings, onChange, disabled, t }: LobbyOptionsProps) {
  const pace = typeof settings.pace === "string" ? settings.pace : "standard";
  const timersEnabled = Boolean(settings.timersEnabled ?? true);
  const revealVotes = Boolean(settings.revealVotes ?? true);

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto select-none p-1">
      <div className="text-center mb-1">
        <h3 className="text-xl font-black text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center justify-center gap-2 mb-neon-gold">
          <BossIcon className="w-5 h-5 text-[var(--mb-gold)]" /> {t("games.merkissioner.name")}
        </h3>
        <p className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.lobby.subtitle")}
        </p>
      </div>

      <Panel className="p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
        <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.settings.pace")}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {PACES.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled}
              aria-pressed={pace === p}
              onClick={() => !disabled && onChange({ pace: p })}
              className={cn(
                "min-h-[44px] px-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_#000] mb-press active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mb-gold)] [font-family:var(--mb-font-display)] uppercase text-center leading-tight",
                pace === p
                  ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                  : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              {t(`games.merkissioner.settings.pace.${p}`)}
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ToggleTile
          disabled={disabled}
          active={timersEnabled}
          icon={<ClockIcon className="w-5 h-5" />}
          label={t("games.merkissioner.settings.timersEnabled")}
          hint={t("games.merkissioner.settings.timersEnabledHint")}
          onToggle={() => !disabled && onChange({ timersEnabled: !timersEnabled })}
          onLabel={t("games.merkissioner.ui.on")}
          offLabel={t("games.merkissioner.ui.off")}
          tone="accent-2"
        />
        <ToggleTile
          disabled={disabled}
          active={revealVotes}
          icon={<BallotIcon className="w-5 h-5" />}
          label={t("games.merkissioner.settings.revealVotes")}
          hint={t("games.merkissioner.settings.revealVotesHint")}
          onToggle={() => !disabled && onChange({ revealVotes: !revealVotes })}
          onLabel={t("games.merkissioner.ui.on")}
          offLabel={t("games.merkissioner.ui.off")}
          tone="violet"
        />
      </div>

      <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col gap-2">
        <span className="text-xs font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.lobby.how_it_plays")}
        </span>
        <div className="flex flex-col gap-1.5">
          {PLAYER_COUNTS.map((n) => {
            const counts = roleCountsFor(n);
            return (
              <div key={n} className="flex items-center justify-between gap-2 text-xs flex-wrap">
                <Pill tone="neutral" className="shrink-0 text-[0.65rem]">
                  {t("games.merkissioner.lobby.player_count_label", { count: n })}
                </Pill>
                <span className="text-[var(--mb-text-dim)] font-bold text-right">
                  {t("games.merkissioner.lobby.role_line", { merkizen: counts.merkizen, merkite: counts.merkite })}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[0.65rem] font-bold text-[var(--mb-text-dim)] mt-1">
          {t("games.merkissioner.lobby.rules_summary")}
        </p>
      </Panel>

      <p className="text-center text-[0.65rem] font-bold text-[var(--mb-text-dim)] opacity-80 mt-1">
        {t("games.merkissioner.credits")}
      </p>
    </div>
  );
}

function ToggleTile({
  disabled,
  active,
  icon,
  label,
  hint,
  onToggle,
  onLabel,
  offLabel,
  tone,
}: {
  disabled: boolean;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onToggle: () => void;
  onLabel: string;
  offLabel: string;
  tone: "accent-2" | "violet";
}) {
  const activeBg =
    tone === "accent-2" ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]" : "bg-[var(--mb-violet)] text-[var(--mb-ink)]";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "p-4 min-h-[64px] rounded-xl border-[3px] border-black flex items-center justify-between text-left mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2",
        active ? activeBg : "bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] opacity-70"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]",
            active ? "bg-[var(--mb-paper)] text-[var(--mb-ink)]" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]"
          )}
        >
          {icon}
        </div>
        <div>
          <p className="font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]">{label}</p>
          <span className="text-xs font-bold opacity-90">{hint}</span>
        </div>
      </div>
      <span className="text-lg font-black shrink-0 ml-2 uppercase [font-family:var(--mb-font-display)]">
        {active ? onLabel : offLabel}
      </span>
    </button>
  );
}
