"use client";

import * as React from "react";
import { cn } from "@merky/ui";

/**
 * Shared semicircular guess dial — the heart of "You got it? Good."
 * Pure SVG, neo-brutalist: thick black rim, flat paper face, chunky needle.
 * Rendered read-only (huge) on Stage and interactively (drag + nudge +
 * keyboard) on Controller.
 *
 * Angle domain: 0 = leftLabel concept, 180 = rightLabel concept, 90 = dead
 * center. The needle is drawn once in a neutral "pointing straight up"
 * orientation and rotated into place via an SVG `rotate()` transform so the
 * Stage can CSS-transition it smoothly while the Controller can snap it
 * instantly during an active drag.
 */

const VB_W = 440;
const VB_H = 300;
const CX = 220;
const CY = 180;
const R = 160;

const PLATE_W = 140;
const PLATE_H = 56;
const PLATE_Y = CY + 18;
const LEFT_PLATE_CX = CX - (R - 30);
const RIGHT_PLATE_CX = CX + (R - 30);

/** Frozen dial math zones (mirrors logic.ts `zonePoints`), as offsets from target. */
const ZONES: { from: number; to: number; pts: 2 | 3 | 4; color: string }[] = [
  { from: -22.5, to: -13.5, pts: 2, color: "var(--mb-violet)" },
  { from: -13.5, to: -4.5, pts: 3, color: "var(--mb-accent)" },
  { from: -4.5, to: 4.5, pts: 4, color: "var(--mb-gold)" },
  { from: 4.5, to: 13.5, pts: 3, color: "var(--mb-accent)" },
  { from: 13.5, to: 22.5, pts: 2, color: "var(--mb-violet)" },
];

function pct(v: number, total: number): string {
  return `${(v / total) * 100}%`;
}

function clampAngle(n: number): number {
  return Math.max(0, Math.min(180, Math.round(n)));
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx - r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`;
}

/** Explicit `number` parameter (not a closure capture) so TS narrowing is unambiguous at call sites. */
function renderZoneWedges(target: number): React.ReactNode {
  return (
    <>
      {ZONES.map((z, i) => {
        const from = clampAngle(target + z.from);
        const to = clampAngle(target + z.to);
        if (from === to) return null;
        return (
          <path
            key={i}
            d={wedgePath(CX, CY, R - 8, from, to)}
            fill={z.color}
            stroke="#000"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        );
      })}
    </>
  );
}

function renderTargetLine(target: number): React.ReactNode {
  const p = polar(CX, CY, R - 10, target);
  return (
    <line
      x1={CX}
      y1={CY}
      x2={p.x}
      y2={p.y}
      stroke="#000"
      strokeWidth={2}
      strokeDasharray="2 5"
      strokeLinecap="round"
      opacity={0.6}
    />
  );
}

function angleFromClientPoint(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  cx: number,
  cy: number
): number {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return 90;
  const vb = svg.viewBox.baseVal;
  const scaleX = vb.width / rect.width;
  const scaleY = vb.height / rect.height;
  const localX = (clientX - rect.left) * scaleX + vb.x;
  const localY = (clientY - rect.top) * scaleY + vb.y;
  const dx = localX - cx;
  const dy = localY - cy;
  if (dy > 0) return dx < 0 ? 0 : 180;
  const deg = Math.atan2(-dy, -dx) * (180 / Math.PI);
  return clampAngle(deg);
}

// Needle drawn once pointing straight up (our angle 90), then rotated by
// (displayAngle - 90) — see the derivation in Stage/Controller callers.
const NEEDLE_TIP = { x: CX, y: CY - (R - 34) };
const NEEDLE_BASE_L = { x: CX - 13, y: CY };
const NEEDLE_BASE_R = { x: CX + 13, y: CY };
const NEEDLE_TAIL = { x: CX, y: CY + 16 };
const NEEDLE_PTS = `${NEEDLE_TAIL.x},${NEEDLE_TAIL.y} ${NEEDLE_BASE_L.x},${NEEDLE_BASE_L.y} ${NEEDLE_TIP.x},${NEEDLE_TIP.y} ${NEEDLE_BASE_R.x},${NEEDLE_BASE_R.y}`;

export interface DialLabels {
  /** Accessible name for the slider / static image. */
  slider?: string;
  nudgeMinus5?: string;
  nudgeMinus1?: string;
  nudgePlus1?: string;
  nudgePlus5?: string;
}

export interface DialProps {
  pointerAngle: number;
  targetAngle?: number;
  revealed?: boolean;
  size?: number;
  leftLabel: string;
  rightLabel: string;
  interactive?: boolean;
  onDrag?: (angle: number) => void;
  disabled?: boolean;
  className?: string;
  labels?: DialLabels;
}

export function Dial({
  pointerAngle,
  targetAngle,
  revealed = false,
  size = 520,
  leftLabel,
  rightLabel,
  interactive = false,
  onDrag,
  disabled = false,
  className,
  labels,
}: DialProps) {
  const draggingRef = React.useRef(false);
  const lastEmitRef = React.useRef(0);
  const [visualAngle, setVisualAngle] = React.useState(() => clampAngle(pointerAngle));
  const live = interactive && !disabled;

  React.useEffect(() => {
    if (!draggingRef.current) setVisualAngle(clampAngle(pointerAngle));
  }, [pointerAngle]);

  const emit = React.useCallback(
    (angle: number, force = false) => {
      if (!onDrag) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (force || now - lastEmitRef.current >= 250) {
        lastEmitRef.current = now;
        onDrag(angle);
      }
    },
    [onDrag]
  );

  const commit = React.useCallback(
    (angle: number, force = false) => {
      const clamped = clampAngle(angle);
      setVisualAngle(clamped);
      emit(clamped, force);
    },
    [emit]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!live) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    commit(angleFromClientPoint(e.clientX, e.clientY, e.currentTarget, CX, CY), true);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!live || !draggingRef.current) return;
    commit(angleFromClientPoint(e.clientX, e.clientY, e.currentTarget, CX, CY));
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    commit(angleFromClientPoint(e.clientX, e.clientY, e.currentTarget, CX, CY), true);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured — fine */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!live) return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        commit(visualAngle - 1, true);
        return;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        commit(visualAngle + 1, true);
        return;
      case "PageDown":
        e.preventDefault();
        commit(visualAngle - 5, true);
        return;
      case "PageUp":
        e.preventDefault();
        commit(visualAngle + 5, true);
        return;
      case "Home":
        e.preventDefault();
        commit(0, true);
        return;
      case "End":
        e.preventDefault();
        commit(180, true);
        return;
      default:
        return;
    }
  };

  const displayAngle = interactive ? visualAngle : clampAngle(pointerAngle);
  const leftEnd = polar(CX, CY, R, 0);
  const rightEnd = polar(CX, CY, R, 180);
  const facePath = `M ${leftEnd.x} ${leftEnd.y} A ${R} ${R} 0 0 1 ${rightEnd.x} ${rightEnd.y} L ${leftEnd.x} ${leftEnd.y} Z`;

  const ticks: React.ReactNode[] = [];
  for (let deg = 0; deg <= 180; deg += 15) {
    const major = deg % 45 === 0;
    const outer = polar(CX, CY, R - 4, deg);
    const inner = polar(CX, CY, major ? R - 26 : R - 14, deg);
    ticks.push(
      <line
        key={deg}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke="#000"
        strokeWidth={major ? 3.5 : 2}
        strokeLinecap="round"
        opacity={major ? 0.85 : 0.45}
      />
    );
  }

  const defaultAria = `Dial from ${leftLabel} to ${rightLabel}`;

  return (
    <div className={cn("select-none w-full flex flex-col items-center", className)} style={{ maxWidth: size }}>
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={cn(
            "w-full h-auto block touch-none overflow-visible",
            live && "cursor-grab active:cursor-grabbing",
            live &&
              "focus-visible:outline focus-visible:outline-4 focus-visible:outline-[var(--mb-line-bright)] focus-visible:outline-offset-4 rounded-3xl"
          )}
          role={interactive ? "slider" : "img"}
          aria-label={labels?.slider ?? defaultAria}
          aria-valuemin={interactive ? 0 : undefined}
          aria-valuemax={interactive ? 180 : undefined}
          aria-valuenow={interactive ? displayAngle : undefined}
          aria-disabled={interactive ? disabled : undefined}
          aria-orientation={interactive ? "horizontal" : undefined}
          tabIndex={live ? 0 : -1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
        >
          {/* Face plate */}
          <path d={facePath} fill="var(--mb-paper)" stroke="#000" strokeWidth={5} strokeLinejoin="round" />

          {/* Reveal wedges (target zones) */}
          {revealed && typeof targetAngle === "number" && (
            <g className="mb-pop">{renderZoneWedges(targetAngle)}</g>
          )}

          {revealed && typeof targetAngle === "number" && renderTargetLine(targetAngle)}

          {/* Rim redrawn on top of wedges for a crisp edge */}
          <path d={facePath} fill="none" stroke="#000" strokeWidth={5} strokeLinejoin="round" />

          {/* Tick marks */}
          {ticks}

          {/* Baseline */}
          <line x1={leftEnd.x} y1={leftEnd.y} x2={rightEnd.x} y2={rightEnd.y} stroke="#000" strokeWidth={4} />

          {/* Needle — drawn neutral (pointing up = our 90°), rotated into place.
              CSS transition smooths Stage updates; disabled mid-drag so the
              Controller's own finger-tracking never feels laggy. */}
          <g
            transform={`rotate(${displayAngle - 90} ${CX} ${CY})`}
            style={{
              transition: draggingRef.current ? "none" : "transform 200ms var(--mb-ease-out, ease-out)",
            }}
          >
            <polygon points={NEEDLE_PTS} transform="translate(6,6)" fill="#000" opacity={0.9} />
            <polygon points={NEEDLE_PTS} fill="var(--mb-accent-2)" stroke="#000" strokeWidth={4} strokeLinejoin="round" />
          </g>

          {/* Pivot */}
          <circle cx={CX} cy={CY} r={17} fill="var(--mb-gold)" stroke="#000" strokeWidth={4} />
          <circle cx={CX} cy={CY} r={5.5} fill="#000" />
        </svg>

        {/* Concept end-cap plates — plain HTML for crisp, wrapping text. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: pct(LEFT_PLATE_CX, VB_W),
            top: pct(PLATE_Y, VB_H),
            width: pct(PLATE_W, VB_W),
            height: pct(PLATE_H, VB_H),
            transform: "translateX(-50%)",
          }}
        >
          <div className="w-full h-full rounded-[10px] border-[3px] border-black bg-[var(--mb-paper)] shadow-[3px_3px_0_0_#000] flex items-center justify-center px-1.5 -rotate-1">
            <span className="text-[10px] sm:text-xs leading-[1.15] font-black uppercase text-black text-center [font-family:var(--mb-font-display)]">
              {leftLabel}
            </span>
          </div>
        </div>
        <div
          className="absolute pointer-events-none"
          style={{
            left: pct(RIGHT_PLATE_CX, VB_W),
            top: pct(PLATE_Y, VB_H),
            width: pct(PLATE_W, VB_W),
            height: pct(PLATE_H, VB_H),
            transform: "translateX(-50%)",
          }}
        >
          <div className="w-full h-full rounded-[10px] border-[3px] border-black bg-[var(--mb-paper)] shadow-[3px_3px_0_0_#000] flex items-center justify-center px-1.5 rotate-1">
            <span className="text-[10px] sm:text-xs leading-[1.15] font-black uppercase text-black text-center [font-family:var(--mb-font-display)]">
              {rightLabel}
            </span>
          </div>
        </div>
      </div>

      {interactive && (
        <div className="flex items-center justify-center gap-2 mt-4" role="group" aria-label={labels?.slider ?? defaultAria}>
          <NudgeButton label={labels?.nudgeMinus5 ?? "-5"} disabled={disabled} onPress={() => commit(visualAngle - 5, true)}>
            −5
          </NudgeButton>
          <NudgeButton label={labels?.nudgeMinus1 ?? "-1"} disabled={disabled} onPress={() => commit(visualAngle - 1, true)}>
            −1
          </NudgeButton>
          <div className="min-w-16 text-center font-black text-lg [font-family:var(--mb-font-display)] text-[var(--mb-text)] tabular-nums" aria-hidden="true">
            {displayAngle}°
          </div>
          <NudgeButton label={labels?.nudgePlus1 ?? "+1"} disabled={disabled} onPress={() => commit(visualAngle + 1, true)}>
            +1
          </NudgeButton>
          <NudgeButton label={labels?.nudgePlus5 ?? "+5"} disabled={disabled} onPress={() => commit(visualAngle + 5, true)}>
            +5
          </NudgeButton>
        </div>
      )}
    </div>
  );
}

function NudgeButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={onPress}
      className={cn(
        "min-w-11 min-h-11 px-2 rounded-lg border-2 border-black font-black text-sm",
        "bg-[var(--mb-surface-2)] text-[var(--mb-text)] shadow-[2px_2px_0_0_#000]",
        "active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all",
        "disabled:opacity-40 disabled:pointer-events-none",
        "focus-visible:outline focus-visible:outline-4 focus-visible:outline-[var(--mb-line-bright)] focus-visible:outline-offset-2"
      )}
    >
      {children}
    </button>
  );
}
