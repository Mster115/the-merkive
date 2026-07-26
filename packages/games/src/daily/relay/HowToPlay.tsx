import * as React from "react";
import type { Translate } from "@merky/game-sdk";

/**
 * A worked two-link example. Relay's whole rule is "the letter you end on is
 * the letter you start the next word with", and a playtester bounced off the
 * game without ever finding it — so the diagram shows the join itself rather
 * than describing it.
 */
function ChainDiagram({ t }: { t: Translate }) {
  const chip = (x: number, fill: string, on: string, head: string, body: string, tail: string) => (
    <g transform={`translate(${x} 20)`}>
      <rect x="3" y="3" width="112" height="40" rx="4" fill="#000" />
      <rect width="112" height="40" rx="4" fill={fill} stroke="#000" strokeWidth="2.5" />
      <text
        x="56"
        y="26"
        textAnchor="middle"
        fill={on}
        fontSize="16"
        fontWeight="900"
        letterSpacing="0.5"
      >
        <tspan textDecoration="underline">{head}</tspan>
        <tspan>{body}</tspan>
        <tspan textDecoration="underline">{tail}</tspan>
      </text>
    </g>
  );

  return (
    <svg
      // Wide enough for the third chip: the last one starts at x=304 and is
      // 112 across, so anything under 420 clips TANGO off the right edge.
      viewBox="0 0 420 104"
      className="w-full h-auto"
      role="img"
      aria-label={t("daily.relay.howto.diagramAlt")}
    >
      {chip(0, "var(--mb-accent)", "var(--mb-on-accent)", "C", "IRCU", "S")}
      <text x="128" y="46" fill="var(--mb-text-dim)" fontSize="18" fontWeight="700">
        →
      </text>
      {chip(152, "var(--mb-surface-2)", "var(--mb-text)", "S", "UNSE", "T")}
      <text x="280" y="46" fill="var(--mb-text-dim)" fontSize="18" fontWeight="700">
        →
      </text>
      {chip(304, "var(--mb-surface-2)", "var(--mb-text)", "T", "ANG", "O")}

      {/* The join being called out: last letter of one word, first of the next. */}
      {/* Anchored on the letters themselves — the S at the end of CIRCUS and
          the S at the start of SUNSET — not on the chips' centres. */}
      <path
        d="M78 66 L78 78 L186 78 L186 66"
        fill="none"
        stroke="var(--mb-gold)"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />
      <text
        x="132"
        y="96"
        textAnchor="middle"
        fill="var(--mb-gold)"
        fontSize="11"
        fontWeight="800"
      >
        {t("daily.relay.howto.diagramCaption")}
      </text>
    </svg>
  );
}

export function HowToPlay({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-[var(--mb-text)]">
      <p className="font-bold">{t("daily.relay.howto.goal")}</p>

      <div className="rounded-md border-2 border-black bg-[var(--mb-surface)] p-3">
        <ChainDiagram t={t} />
      </div>

      <ol className="flex flex-col gap-2 list-decimal pl-5 marker:font-black marker:text-[var(--mb-violet)]">
        <li>{t("daily.relay.howto.step1")}</li>
        <li>{t("daily.relay.howto.step2")}</li>
        <li>{t("daily.relay.howto.step3")}</li>
      </ol>

      <p className="text-xs text-[var(--mb-text-dim)] font-semibold">
        {t("daily.relay.howto.note")}
      </p>
    </div>
  );
}
