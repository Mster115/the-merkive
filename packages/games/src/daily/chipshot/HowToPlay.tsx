import * as React from "react";
import type { Translate } from "@merky/game-sdk";

export function ChipShotHowToPlay({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-4 p-1">
      <h3 className="font-black uppercase text-center">
        {t("daily.chipshot.howto.goal")}
      </h3>

      <div className="max-w-xs mx-auto my-4 w-full">
        <svg
          viewBox="0 0 300 200"
          className="w-full h-auto"
          aria-label="Diagram showing a golf ball, aim arrow, power bar, and hole with flag"
          role="img"
        >
          {/* Golf Green Area */}
          <rect
            x="20"
            y="20"
            width="260"
            height="160"
            rx="20"
            fill="var(--mb-accent-2)"
            stroke="var(--mb-ink)"
            strokeWidth="4"
          />
          {/* Walls/Obstacles */}
          <line
            x1="150"
            y1="20"
            x2="150"
            y2="100"
            stroke="var(--mb-ink)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <line
            x1="150"
            y1="140"
            x2="150"
            y2="180"
            stroke="var(--mb-ink)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Hole */}
          <circle cx="230" cy="100" r="10" fill="var(--mb-ink)" />
          {/* Flag */}
          <path
            d="M 230 100 L 230 40"
            stroke="var(--mb-ink)"
            strokeWidth="3"
          />
          <polygon
            points="230,40 260,55 230,70"
            fill="var(--mb-gold)"
            stroke="var(--mb-ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Ball */}
          <circle
            cx="70"
            cy="100"
            r="6"
            fill="#fff"
            stroke="var(--mb-ink)"
            strokeWidth="2"
          />

          {/* Aim Arrow */}
          <path
            d="M 85 95 L 120 80"
            stroke="var(--mb-text)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <polygon
            points="120,80 126,86 116,84"
            fill="var(--mb-text)"
          />

          {/* Power Bar */}
          <rect
            x="40"
            y="150"
            width="80"
            height="12"
            rx="6"
            fill="#fff"
            stroke="var(--mb-ink)"
            strokeWidth="2"
          />
          <rect x="40" y="150" width="50" height="12" rx="6" fill="var(--mb-ink)" />
        </svg>
      </div>

      <ol className="list-decimal pl-6 flex flex-col gap-2 text-base">
        <li>{t("daily.chipshot.howto.step1")}</li>
        <li>{t("daily.chipshot.howto.step2")}</li>
        <li>{t("daily.chipshot.howto.step3")}</li>
      </ol>
    </div>
  );
}
