"use client";
import * as React from "react";
import type { GameModule } from "@merky/game-sdk";
import { cn } from "@merky/ui";
import { useT } from "@/i18n";
import { api } from "@/client/api";

/** Renders a game's declarative house-rule fields for the host. */
export function SettingsFields({
  game,
  settings,
  disabled,
  onChange,
}: {
  game: GameModule;
  settings: Record<string, unknown>;
  disabled: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const t = useT();
  const merged = { ...game.meta.defaultSettings, ...settings };
  const [packs, setPacks] = React.useState<{ id: string; title?: string; titleKey?: string }[]>([]);
  const needsPacks = game.meta.settingFields.some((f) => f.type === "pack");

  React.useEffect(() => {
    if (!needsPacks) return;
    let cancelled = false;
    api
      .listPacks(game.meta.id)
      .then((list) => {
        if (!cancelled) setPacks(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [game.meta.id, needsPacks]);

  if (game.meta.settingFields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {game.meta.settingFields.map((field) => {
        const value = merged[field.key];
        if (field.type === "boolean") {
          const on = value === true;
          return (
            <button
              key={field.key}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange({ [field.key]: !on })}
              className="flex items-center justify-between gap-3 min-h-11 rounded-xl bg-[var(--mb-bg-2)] px-3 disabled:opacity-50"
            >
              <span className="font-bold text-sm">{t(field.labelKey)}</span>
              <span
                className={cn(
                  "w-12 h-7 rounded-full p-1 transition-colors",
                  on ? "bg-[var(--mb-ok)]" : "bg-[var(--mb-line)]"
                )}
              >
                <span
                  className={cn(
                    "block w-5 h-5 rounded-full bg-white transition-transform",
                    on && "translate-x-5"
                  )}
                />
              </span>
            </button>
          );
        }
        if (field.type === "number") {
          const n = typeof value === "number" ? value : field.default;
          return (
            <label key={field.key} className="flex items-center justify-between gap-3 min-h-11 rounded-xl bg-[var(--mb-bg-2)] px-3">
              <span className="font-bold text-sm">{t(field.labelKey)}</span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="decrease"
                  disabled={disabled || n <= field.min}
                  onClick={() => onChange({ [field.key]: Math.max(field.min, n - (field.step ?? 1)) })}
                  className="w-9 h-9 rounded-lg bg-[var(--mb-surface-2)] font-black disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-10 text-center font-black tabular-nums">{n}</span>
                <button
                  type="button"
                  aria-label="increase"
                  disabled={disabled || n >= field.max}
                  onClick={() => onChange({ [field.key]: Math.min(field.max, n + (field.step ?? 1)) })}
                  className="w-9 h-9 rounded-lg bg-[var(--mb-surface-2)] font-black disabled:opacity-40"
                >
                  +
                </button>
              </span>
            </label>
          );
        }
        if (field.type === "select") {
          const v = typeof value === "string" ? value : field.default;
          return (
            <label key={field.key} className="flex items-center justify-between gap-3 min-h-11 rounded-xl bg-[var(--mb-bg-2)] px-3">
              <span className="font-bold text-sm">{t(field.labelKey)}</span>
              <select
                disabled={disabled}
                value={v}
                onChange={(e) => onChange({ [field.key]: e.target.value })}
                className="min-h-9 rounded-lg bg-[var(--mb-surface-2)] px-2 font-bold"
              >
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        // pack picker
        const v = typeof value === "string" ? value : field.default;
        return (
          <label key={field.key} className="flex items-center justify-between gap-3 min-h-11 rounded-xl bg-[var(--mb-bg-2)] px-3">
            <span className="font-bold text-sm">{t(field.labelKey)}</span>
            <select
              disabled={disabled}
              value={v}
              onChange={(e) => onChange({ [field.key]: e.target.value })}
              className="min-h-9 max-w-40 rounded-lg bg-[var(--mb-surface-2)] px-2 font-bold"
            >
              {packs.length === 0 && <option value={v}>{v}</option>}
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titleKey ? t(p.titleKey) : (p.title ?? p.id)}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
