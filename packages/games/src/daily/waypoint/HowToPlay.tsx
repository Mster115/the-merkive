import * as React from "react";
import type { Translate } from "@merky/game-sdk";

/**
 * Interactive Vector Radar Diagram for HowToPlay guide.
 */
function WaypointRadarDiagram({ t }: { t: Translate }) {
  return (
    <svg
      viewBox="0 0 400 160"
      className="w-full h-auto select-none"
      role="img"
      aria-label={t("daily.waypoint.howto.diagramAlt")}
    >
      <rect width="400" height="160" rx="8" fill="var(--mb-surface)" stroke="#000" strokeWidth="2" />

      {/* Radar concentric circles */}
      <circle cx="100" cy="80" r="60" fill="none" stroke="var(--mb-line-dim)" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="100" cy="80" r="40" fill="none" stroke="var(--mb-accent)" strokeWidth="2" opacity="0.6" />
      <circle cx="100" cy="80" r="20" fill="none" stroke="var(--mb-accent)" strokeWidth="2" />
      <line x1="100" y1="10" x2="100" y2="150" stroke="var(--mb-line-dim)" strokeWidth="1.5" />
      <line x1="30" y1="80" x2="170" y2="80" stroke="var(--mb-line-dim)" strokeWidth="1.5" />

      {/* Origin & Guess Vector */}
      <circle cx="100" cy="80" fill="var(--mb-pink)" r="5" stroke="#000" strokeWidth="2" />
      <line x1="100" y1="80" x2="135" y2="45" stroke="var(--mb-gold)" strokeWidth="3" strokeDasharray="3 2" />
      <circle cx="135" cy="45" fill="var(--mb-gold)" r="6" stroke="#000" strokeWidth="2" />

      {/* Arrow Vector Callout */}
      <g transform="translate(200, 35)">
        <rect width="180" height="90" rx="6" fill="var(--mb-surface-2)" stroke="#000" strokeWidth="2" />
        <text x="72" y="30" textAnchor="middle" fill="var(--mb-text)" fontSize="14" fontWeight="900">
          2,450 km
        </text>
        {/* Bearing needle, drawn inline so the guide uses the same mark as play. */}
        <g transform="translate(124, 18) rotate(45)" stroke="var(--mb-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M8 1.5v13" />
          <path d="M3.5 6L8 1.5 12.5 6" />
        </g>
        <text x="90" y="55" textAnchor="middle" fill="var(--mb-text-dim)" fontSize="11" fontWeight="700">
          {t("daily.waypoint.howto.diagramCaption")}
        </text>
        <text x="90" y="75" textAnchor="middle" fill="var(--mb-accent-2)" fontSize="11" fontWeight="800">
          {t("daily.waypoint.howto.vectorHint")}
        </text>
      </g>
    </svg>
  );
}

export function HowToPlay({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-[var(--mb-text)]">
      <p className="font-bold">{t("daily.waypoint.howto.goal")}</p>

      <div className="rounded-md border-2 border-black bg-[var(--mb-surface)] p-3">
        <WaypointRadarDiagram t={t} />
      </div>

      <ol className="flex flex-col gap-2 list-decimal pl-5 marker:font-black marker:text-[var(--mb-violet)]">
        <li>{t("daily.waypoint.howto.step1")}</li>
        <li>{t("daily.waypoint.howto.step2")}</li>
        <li>{t("daily.waypoint.howto.step3")}</li>
      </ol>

      <p className="text-xs text-[var(--mb-text-dim)] font-semibold">
        {t("daily.waypoint.howto.note")}
      </p>
    </div>
  );
}
