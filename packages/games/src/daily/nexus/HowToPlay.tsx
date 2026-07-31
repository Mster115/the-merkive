import * as React from "react";
import type { Translate } from "@merky/game-sdk";

/**
 * A miniature of the board with one intersection lit up. Nexus's premise —
 * that a question belongs to *two* categories at once — is the thing a new
 * player has to grasp, and it is far quicker to show than to explain.
 */
function MatrixDiagram({ t }: { t: Translate }) {
  const cols = [t("daily.nexus.howto.colA"), t("daily.nexus.howto.colB")];
  const rows = [t("daily.nexus.howto.rowA"), t("daily.nexus.howto.rowB")];

  const cell = (x: number, y: number, fill: string, stroke: string) => (
    <>
      <rect x={x + 2} y={y + 2} width="86" height="34" rx="3" fill="#000" />
      <rect
        x={x}
        y={y}
        width="86"
        height="34"
        rx="3"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
    </>
  );

  const label = (x: number, y: number, text: string, fill: string) => (
    <text
      x={x + 43}
      y={y + 22}
      textAnchor="middle"
      fill={fill}
      fontSize="11"
      fontWeight="800"
      letterSpacing="0.4"
    >
      {text}
    </text>
  );

  return (
    <svg
      viewBox="0 0 290 146"
      className="w-full h-auto"
      role="img"
      aria-label={t("daily.nexus.howto.diagramAlt")}
    >
      {cols.map((c, i) => (
        <g key={c}>
          {cell(98 + i * 94, 4, "var(--mb-surface-3)", "#000")}
          {label(98 + i * 94, 4, c, "var(--mb-violet)")}
        </g>
      ))}

      {rows.map((r, i) => (
        <g key={r}>
          {cell(2, 44 + i * 42, "var(--mb-surface-3)", "#000")}
          {label(2, 44 + i * 42, r, "var(--mb-violet)")}
        </g>
      ))}

      {/* The lit intersection: row 0 × col 0. */}
      {cell(98, 44, "var(--mb-accent)", "var(--mb-gold)")}
      {label(98, 44, "?", "var(--mb-on-accent)")}
      {cell(192, 44, "var(--mb-surface)", "#000")}
      {label(192, 44, "?", "var(--mb-text-dim)")}
      {cell(98, 86, "var(--mb-surface)", "#000")}
      {label(98, 86, "?", "var(--mb-text-dim)")}
      {cell(192, 86, "var(--mb-surface)", "#000")}
      {label(192, 86, "?", "var(--mb-text-dim)")}

      <text
        x="145"
        y="140"
        textAnchor="middle"
        fill="var(--mb-gold)"
        fontSize="10"
        fontWeight="800"
      >
        {t("daily.nexus.howto.diagramCaption")}
      </text>
    </svg>
  );
}

export function HowToPlay({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-[var(--mb-text)]">
      <p className="font-bold">{t("daily.nexus.howto.goal")}</p>

      <div className="rounded-md border-2 border-black bg-[var(--mb-surface)] p-3">
        <MatrixDiagram t={t} />
      </div>

      <ol className="flex flex-col gap-2 list-decimal pl-5 marker:font-black marker:text-[var(--mb-violet)]">
        <li>{t("daily.nexus.howto.step1")}</li>
        <li>{t("daily.nexus.howto.step2")}</li>
        <li>{t("daily.nexus.howto.step3")}</li>
        <li>{t("daily.nexus.howto.step4")}</li>
        <li>{t("daily.nexus.howto.step5")}</li>
      </ol>

      <p className="text-xs text-[var(--mb-text-dim)] font-semibold">
        {t("daily.nexus.howto.note")}
      </p>
    </div>
  );
}
