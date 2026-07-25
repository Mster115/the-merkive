import * as React from "react";
import type { Translate } from "@merky/game-sdk";

/**
 * Shows the one interaction that is not obvious from looking at the board:
 * a square belongs to two words, and tapping it again switches which of them
 * you are typing into.
 */
function GridDiagram({ t }: { t: Translate }) {
  const SIZE = 26;
  const GAP = 3;
  const at = (i: number) => i * (SIZE + GAP);

  // Row 1 is the across word; column 2 is the down word; they cross at (1,2).
  const across = new Set(["1-0", "1-1", "1-2", "1-3"]);
  const down = new Set(["0-2", "1-2", "2-2", "3-2"]);

  const squares = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const key = `${r}-${c}`;
      const isCross = across.has(key) && down.has(key);
      const fill = isCross
        ? "var(--mb-gold)"
        : across.has(key)
        ? "var(--mb-accent)"
        : down.has(key)
        ? "var(--mb-pink)"
        : "var(--mb-paper)";
      squares.push(
        <rect
          key={key}
          x={at(c)}
          y={at(r)}
          width={SIZE}
          height={SIZE}
          rx="2"
          fill={fill}
          stroke="#000"
          strokeWidth="2"
        />
      );
    }
  }

  return (
    <svg
      viewBox="0 0 240 142"
      className="w-full h-auto"
      role="img"
      aria-label={t("daily.nutshell.howto.diagramAlt")}
    >
      <g transform="translate(4 8)">{squares}</g>

      <g transform="translate(140 8)">
        <rect width="14" height="14" rx="2" fill="var(--mb-accent)" stroke="#000" strokeWidth="2" />
        <text x="22" y="12" fill="var(--mb-text)" fontSize="11" fontWeight="800">
          {t("daily.nutshell.howto.legendAcross")}
        </text>

        <rect y="26" width="14" height="14" rx="2" fill="var(--mb-pink)" stroke="#000" strokeWidth="2" />
        <text x="22" y="38" fill="var(--mb-text)" fontSize="11" fontWeight="800">
          {t("daily.nutshell.howto.legendDown")}
        </text>

        <rect y="52" width="14" height="14" rx="2" fill="var(--mb-gold)" stroke="#000" strokeWidth="2" />
        <text x="22" y="64" fill="var(--mb-text)" fontSize="11" fontWeight="800">
          {t("daily.nutshell.howto.legendCross")}
        </text>
      </g>

      <text x="4" y="136" fill="var(--mb-gold)" fontSize="10" fontWeight="800">
        {t("daily.nutshell.howto.diagramCaption")}
      </text>
    </svg>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block rounded border-2 border-black bg-[var(--mb-surface-2)] px-1.5 py-0.5 text-[11px] font-black shadow-[2px_2px_0_0_#000]">
      {children}
    </kbd>
  );
}

export function HowToPlay({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-[var(--mb-text)]">
      <p className="font-bold">{t("daily.nutshell.howto.goal")}</p>

      <div className="rounded-md border-2 border-black bg-[var(--mb-surface)] p-3">
        <GridDiagram t={t} />
      </div>

      <ol className="flex flex-col gap-2 list-decimal pl-5 marker:font-black marker:text-[var(--mb-violet)]">
        <li>{t("daily.nutshell.howto.step1")}</li>
        <li>{t("daily.nutshell.howto.step2")}</li>
        <li>{t("daily.nutshell.howto.step3")}</li>
      </ol>

      <div className="rounded-md border-2 border-black bg-[var(--mb-surface-2)] p-3">
        <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--mb-violet)]">
          {t("daily.nutshell.howto.keysTitle")}
        </h3>
        <ul className="flex flex-col gap-1.5 text-xs">
          <li>
            <Key>Space</Key> — {t("daily.nutshell.howto.keySpace")}
          </li>
          <li>
            <Key>←</Key> <Key>↑</Key> <Key>↓</Key> <Key>→</Key> —{" "}
            {t("daily.nutshell.howto.keyArrows")}
          </li>
          <li>
            <Key>Backspace</Key> — {t("daily.nutshell.howto.keyBackspace")}
          </li>
        </ul>
      </div>

      <p className="text-xs text-[var(--mb-text-dim)] font-semibold">
        {t("daily.nutshell.howto.note")}
      </p>
    </div>
  );
}
