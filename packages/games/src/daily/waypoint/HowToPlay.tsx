import * as React from "react";
import type { Translate } from "@merky/game-sdk";

/**
 * The guide's diagram shows the same thing play does: two rings crossing.
 *
 * It used to be a radar with a needle rotating continuously, which taught the
 * wrong game twice over — there is no radar, and the direction a guess reports
 * is one of eight sectors, not a continuous angle.
 */
function WaypointRingsDiagram({ t }: { t: Translate }) {
  return (
    <svg
      viewBox="0 0 400 160"
      className="w-full h-auto select-none"
      role="img"
      aria-label={t("daily.waypoint.howto.diagramAlt")}
    >
      <rect width="400" height="160" rx="8" fill="var(--mb-surface)" stroke="#000" strokeWidth="2" />

      {/* Two guesses, each ringed by everywhere that far from it. Where the
          rings meet is the target — the same picture play draws. */}
      <circle cx="75" cy="115" r="58" fill="none" stroke="var(--mb-line-dim)" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="170" cy="125" r="70" fill="none" stroke="var(--mb-accent)" strokeWidth="2" />

      <circle cx="75" cy="115" r="7" fill="var(--mb-gold)" stroke="#000" strokeWidth="2" />
      <text x="75" y="118.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#000">1</text>
      <circle cx="170" cy="125" r="7" fill="var(--mb-gold)" stroke="#000" strokeWidth="2" />
      <text x="170" y="128.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#000">2</text>

      {/* The crossing, marked by shape as well as colour. Sits on both rings:
          centres 95.5 apart, radii 58 and 70. */}
      <g stroke="var(--mb-accent-2)" strokeWidth="2.5" fill="none">
        <circle cx="110" cy="77" r="9" />
        <path d="M110 62v10M110 82v10M95 77h10M115 77h10" />
      </g>

      <g transform="translate(248, 34)">
        <rect width="140" height="92" rx="6" fill="var(--mb-surface-2)" stroke="#000" strokeWidth="2" />
        <text x="58" y="32" textAnchor="middle" fill="var(--mb-text)" fontSize="14" fontWeight="900">
          2,450 km
        </text>
        {/* Same mark as play, and like play it snaps to one of eight sectors. */}
        <g transform="translate(106, 20) rotate(45)" stroke="var(--mb-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M8 1.5v13" />
          <path d="M3.5 6L8 1.5 12.5 6" />
        </g>
        <text x="70" y="56" textAnchor="middle" fill="var(--mb-text-dim)" fontSize="11" fontWeight="700">
          {t("daily.waypoint.howto.diagramCaption")}
        </text>
        <text x="70" y="76" textAnchor="middle" fill="var(--mb-accent-2)" fontSize="11" fontWeight="800">
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
        <WaypointRingsDiagram t={t} />
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
