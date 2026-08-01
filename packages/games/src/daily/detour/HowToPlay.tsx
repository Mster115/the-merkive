"use client";
import * as React from "react";
import type { Translate } from "@merky/game-sdk";

export function HowToPlay({ t }: { t: Translate }) {
  return (
    <div className="space-y-4 text-sm text-[var(--mb-text)]">
      <p className="font-bold leading-relaxed">{t("daily.detour.howto.goal")}</p>

      <div className="flex flex-col items-center rounded-xl border-2 border-black bg-[var(--mb-surface)] p-4 shadow-[4px_4px_0_0_#000]">
        <svg
          viewBox="0 0 320 120"
          className="h-28 w-full max-w-[320px]"
          role="img"
          aria-label={t("daily.detour.howto.diagramAlt")}
        >
          <rect
            width="320"
            height="120"
            rx="8"
            fill="var(--mb-bg)"
            stroke="#000"
            strokeWidth="2"
          />

          {/* Start */}
          <circle
            cx="50"
            cy="55"
            r="13"
            fill="var(--mb-accent)"
            stroke="#000"
            strokeWidth="2"
          />
          <circle cx="50" cy="55" r="4" fill="var(--mb-on-accent)" />
          <text
            x="50"
            y="92"
            textAnchor="middle"
            fill="var(--mb-text-dim)"
            fontSize="10"
            fontWeight="bold"
          >
            {t("daily.detour.howto.diagramStart")}
          </text>

          <path
            d="M 64 55 L 146 55"
            stroke="var(--mb-accent-2)"
            strokeWidth="3"
            strokeDasharray="6 3"
          />

          {/* Intermediate hop */}
          <circle
            cx="160"
            cy="55"
            r="13"
            fill="var(--mb-accent-2)"
            stroke="#000"
            strokeWidth="2"
          />
          <circle cx="160" cy="55" r="4" fill="var(--mb-on-accent-2)" />
          <text
            x="160"
            y="92"
            textAnchor="middle"
            fill="var(--mb-text-dim)"
            fontSize="10"
            fontWeight="bold"
          >
            {t("daily.detour.howto.diagramHop")}
          </text>

          <path
            d="M 174 55 L 256 55"
            stroke="var(--mb-accent-2)"
            strokeWidth="3"
            strokeDasharray="6 3"
          />

          {/* Target — concentric rings read as a destination without an emoji */}
          <circle
            cx="270"
            cy="55"
            r="13"
            fill="var(--mb-gold)"
            stroke="#000"
            strokeWidth="2"
          />
          <circle
            cx="270"
            cy="55"
            r="7"
            fill="none"
            stroke="var(--mb-on-gold)"
            strokeWidth="2"
          />
          <circle cx="270" cy="55" r="2" fill="var(--mb-on-gold)" />
          <text
            x="270"
            y="92"
            textAnchor="middle"
            fill="var(--mb-text-dim)"
            fontSize="10"
            fontWeight="bold"
          >
            {t("daily.detour.howto.diagramTarget")}
          </text>
        </svg>
        <span className="mt-2 text-xs text-[var(--mb-text-dim)]">
          {t("daily.detour.howto.diagramCaption")}
        </span>
      </div>

      <ol className="space-y-3 font-medium">
        {["step1", "step2", "step3"].map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[var(--mb-accent)] text-xs font-black text-[var(--mb-on-accent)]">
              {i + 1}
            </span>
            <span>{t(`daily.detour.howto.${step}`)}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border-2 border-black bg-[var(--mb-surface)] p-3 text-xs text-[var(--mb-text-dim)]">
        {t("daily.detour.howto.note")}
      </div>
    </div>
  );
}
