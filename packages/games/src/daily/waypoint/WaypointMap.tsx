"use client";
import * as React from "react";
import { MAP_VIEWBOX, WORLD_PATH, projectPoint } from "./worldMap";
import type { WaypointGuess } from "./types";

const EARTH_RADIUS_KM = 6371;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * Destination point a given distance and bearing from an origin, on a sphere.
 * Used to trace the ring of places exactly `distanceKm` from a guess.
 */
function destination(
  lat: number,
  lng: number,
  distanceKm: number,
  bearingDeg: number
): [number, number] {
  const d = distanceKm / EARTH_RADIUS_KM;
  const br = bearingDeg * RAD;
  const p1 = lat * RAD;
  const l1 = lng * RAD;

  const sinP2 =
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br);
  const p2 = Math.asin(Math.max(-1, Math.min(1, sinP2)));
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * sinP2
    );
  return [p2 * DEG, ((l2 * DEG + 540) % 360) - 180];
}

/**
 * The ring of points at `distanceKm` from a guess, as SVG subpaths.
 *
 * This is a true geodesic circle, so on an equirectangular map it is a curve,
 * not a circle — that distortion is real and drawing an actual ellipse here
 * would quietly lie about where the target can be. The ring is split wherever
 * it crosses the antimeridian so it does not sweep across the whole map.
 */
function ringPath(lat: number, lng: number, distanceKm: number): string {
  const STEPS = 180;
  const segments: string[][] = [[]];
  let prevX: number | null = null;

  for (let i = 0; i <= STEPS; i++) {
    const [plat, plng] = destination(lat, lng, distanceKm, (i / STEPS) * 360);
    const { x, y } = projectPoint(plat, plng);
    if (prevX !== null && Math.abs(x - prevX) > 180) segments.push([]);
    segments[segments.length - 1]!.push(
      `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`
    );
    prevX = x;
  }

  return segments
    .filter((s) => s.length > 1)
    .map((s) => `M${s.join("L")}`)
    .join("");
}

export interface WaypointMapProps {
  guesses: WaypointGuess[];
  /** Set only once the attempt is over. */
  targetCoordinates?: [number, number];
  targetLocationName?: string;
  /** Endgame styling: brighter, joins each guess to the revealed target. */
  revealed?: boolean;
  className?: string;
}

/**
 * Static, non-interactive world map.
 *
 * Deliberately has no pan, zoom, drag or tile layer: the whole world is always
 * in frame, so nothing is reachable only by a pinch. It carries no information
 * that is not also in the guess list, and is `aria-hidden` — the list is the
 * accessible representation of this data, and the game stays completable with
 * the map never rendered at all.
 */
export function WaypointMap({
  guesses,
  targetCoordinates,
  targetLocationName,
  revealed = false,
  className = "",
}: WaypointMapProps) {
  const plotted = guesses.filter(
    (g): g is WaypointGuess & { coordinates: [number, number] } =>
      Array.isArray(g.coordinates)
  );

  const { x, y, w, h } = MAP_VIEWBOX;
  const lastIdx = plotted.length - 1;

  return (
    <div
      className={`relative overflow-hidden rounded-md border-2 border-black bg-[var(--mb-bg-2)] shadow-[4px_4px_0_0_#000] ${className}`}
    >
      <svg
        viewBox={`${x} ${y} ${w} ${h}`}
        className="block h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <rect x={x} y={y} width={w} height={h} fill="var(--mb-bg-2)" />
        <path
          d={WORLD_PATH}
          fill="var(--mb-surface-3)"
          stroke="#000"
          strokeWidth={0.5}
          strokeLinejoin="round"
        />

        {/* Distance rings: every place the target could be, given that guess. */}
        {plotted.map((g, i) =>
          g.isCorrect ? null : (
            <path
              key={`ring-${i}`}
              d={ringPath(g.coordinates[0], g.coordinates[1], g.distanceKm)}
              fill="none"
              stroke={
                i === lastIdx ? "var(--mb-accent)" : "var(--mb-line-dim)"
              }
              strokeWidth={i === lastIdx ? 1.1 : 0.6}
              strokeOpacity={i === lastIdx ? 0.95 : 0.5}
            />
          )
        )}

        {/* Guess pins, numbered to match the history list. */}
        {plotted.map((g, i) => {
          const p = projectPoint(g.coordinates[0], g.coordinates[1]);
          return (
            <g key={`pin-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={3.4}
                fill={
                  g.isCorrect ? "var(--mb-accent-2)" : "var(--mb-gold)"
                }
                stroke="#000"
                strokeWidth={0.9}
              />
              <text
                x={p.x}
                y={p.y + 1.3}
                textAnchor="middle"
                fontSize={4}
                fontWeight="900"
                fill="#000"
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* Target, revealed only when the attempt is over. */}
        {revealed && targetCoordinates && (
          <g>
            {plotted.map((g, i) => {
              const a = projectPoint(g.coordinates[0], g.coordinates[1]);
              const b = projectPoint(
                targetCoordinates[0],
                targetCoordinates[1]
              );
              // Skip the join when it would sweep the map on the short way
              // round; a straight line there would be visually wrong.
              if (Math.abs(a.x - b.x) > 180) return null;
              return (
                <line
                  key={`join-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--mb-violet)"
                  strokeWidth={0.5}
                  strokeDasharray="2 1.5"
                  strokeOpacity={0.75}
                />
              );
            })}
            {(() => {
              const p = projectPoint(
                targetCoordinates[0],
                targetCoordinates[1]
              );
              return (
                <g>
                  {/* Distinguished by shape as well as colour. */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="none"
                    stroke="var(--mb-accent-2)"
                    strokeWidth={1.2}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={2.6}
                    fill="var(--mb-accent-2)"
                    stroke="#000"
                    strokeWidth={0.9}
                  />
                  <line
                    x1={p.x - 9}
                    y1={p.y}
                    x2={p.x - 7}
                    y2={p.y}
                    stroke="var(--mb-accent-2)"
                    strokeWidth={1.2}
                  />
                  <line
                    x1={p.x + 7}
                    y1={p.y}
                    x2={p.x + 9}
                    y2={p.y}
                    stroke="var(--mb-accent-2)"
                    strokeWidth={1.2}
                  />
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {revealed && targetLocationName && (
        <p className="border-t-2 border-black bg-[var(--mb-surface)] px-3 py-2 text-center text-xs font-bold text-[var(--mb-text-dim)]">
          {targetLocationName}
        </p>
      )}
    </div>
  );
}
