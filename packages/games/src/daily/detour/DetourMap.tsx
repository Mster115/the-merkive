"use client";
import * as React from "react";
import type { Translate } from "@merky/game-sdk";
import type { DetourSubmittedHop } from "./types";

interface DetourMapProps {
  t: Translate;
  cityName: string;
  startPoi: {
    id: string;
    name: string;
    district: string;
    coordinates: [number, number];
  };
  hopsSubmitted: DetourSubmittedHop[];
  currentHopIndex: number;
  totalHops: number;
  destinationPoi?: {
    name: string;
    coordinates: [number, number];
  };
}

const VIEW_W = 800;
const VIEW_H = 600;

/**
 * Plots the trail the player has actually walked: the start, every hop they
 * committed, and — once the puzzle is over — the destination.
 *
 * It deliberately does NOT plot the unguessed landmark bank. An earlier build
 * did, positioning those pins by hashing each landmark's name, so the map
 * disagreed with the tier-1 distance-and-direction clues and any player
 * reasoning from it was reasoning from noise. Plotting them truthfully is not
 * an option either: real coordinates for the whole bank turn every tier-1 clue
 * into an arithmetic exercise. Showing only committed hops keeps the map
 * honest and the puzzle intact.
 */
export function DetourMap({
  t,
  cityName,
  startPoi,
  hopsSubmitted,
  currentHopIndex,
  totalHops,
  destinationPoi,
}: DetourMapProps) {
  const plotted = React.useMemo(() => {
    const points: Array<{
      key: string;
      name: string;
      coordinates: [number, number];
      kind: "start" | "hop" | "detour" | "destination";
      distanceKm?: number;
    }> = [
      {
        key: "start",
        name: startPoi.name,
        coordinates: startPoi.coordinates,
        kind: "start",
      },
    ];

    hopsSubmitted.forEach((h, i) => {
      if (!h.coordinates) return;
      points.push({
        key: `hop-${i}`,
        name: h.poiName,
        coordinates: h.coordinates,
        kind: h.isCorrect ? "hop" : "detour",
        distanceKm: h.detourDistanceKm,
      });
    });

    if (destinationPoi) {
      points.push({
        key: "destination",
        name: destinationPoi.name,
        coordinates: destinationPoi.coordinates,
        kind: "destination",
      });
    }

    return points;
  }, [startPoi, hopsSubmitted, destinationPoi]);

  const project = React.useMemo(() => {
    const lats = plotted.map((p) => p.coordinates[0]);
    const lngs = plotted.map((p) => p.coordinates[1]);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    // Guard the single-point case and pad so pins never touch the frame.
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    minLat -= latSpan * 0.25;
    maxLat += latSpan * 0.25;
    minLng -= lngSpan * 0.25;
    maxLng += lngSpan * 0.25;

    // Longitude degrees narrow with latitude; without this a north-south city
    // renders stretched sideways.
    const lngScale = Math.max(
      Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180),
      0.01
    );
    const worldW = (maxLng - minLng) * lngScale;
    const worldH = maxLat - minLat;
    const scale = Math.min(VIEW_W / worldW, VIEW_H / worldH) * 0.8;
    const offsetX = (VIEW_W - worldW * scale) / 2;
    const offsetY = (VIEW_H - worldH * scale) / 2;

    return (coord: [number, number]) => ({
      x: offsetX + (coord[1] - minLng) * lngScale * scale,
      y: offsetY + (maxLat - coord[0]) * scale,
    });
  }, [plotted]);

  const positions = plotted.map((p) => ({ ...p, pos: project(p.coordinates) }));
  const start = positions[0]!;
  // The route line joins only the legs that actually advanced the player.
  const routePoints = positions.filter(
    (p) => p.kind === "start" || p.kind === "hop" || p.kind === "destination"
  );

  return (
    <section className="w-full overflow-hidden rounded-xl border-4 border-black bg-[var(--mb-bg-2)] p-3 text-[var(--mb-text)] shadow-[8px_8px_0_0_#000]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-md border-2 border-black bg-[var(--mb-accent)] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[var(--mb-on-accent)] shadow-[2px_2px_0_0_#000]">
          {t("daily.detour.map.heading", { city: cityName })}
        </span>
        <span className="text-xs font-bold text-[var(--mb-text-dim)]">
          {t("daily.detour.hopCounter", {
            used: currentHopIndex,
            total: totalHops,
          })}
        </span>
      </div>

      <div className="w-full overflow-hidden rounded-lg border-2 border-black bg-[var(--mb-bg)]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={t("daily.detour.map.canvasLabel", { city: cityName })}
        >
          <defs>
            <pattern
              id="detour-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="var(--mb-line-dim)"
                strokeWidth="1"
                opacity="0.5"
              />
            </pattern>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="var(--mb-bg)" />
          <rect width={VIEW_W} height={VIEW_H} fill="url(#detour-grid)" />

          {/* Route travelled */}
          {routePoints.slice(1).map((pt, i) => {
            const prev = routePoints[i]!;
            return (
              <line
                key={`leg-${pt.key}`}
                x1={prev.pos.x}
                y1={prev.pos.y}
                x2={pt.pos.x}
                y2={pt.pos.y}
                stroke="var(--mb-accent-2)"
                strokeWidth="5"
                strokeDasharray="10 5"
                strokeLinecap="round"
              />
            );
          })}

          {/* Wrong turns branch off the last good position */}
          {positions.map((p, i) => {
            if (p.kind !== "detour") return null;
            const anchor =
              [...positions.slice(0, i)]
                .reverse()
                .find((q) => q.kind !== "detour") ?? start;
            return (
              <line
                key={`detour-leg-${p.key}`}
                x1={anchor.pos.x}
                y1={anchor.pos.y}
                x2={p.pos.x}
                y2={p.pos.y}
                stroke="var(--mb-danger)"
                strokeWidth="3"
                strokeDasharray="4 4"
              />
            );
          })}

          {positions.map((p) => (
            <g key={p.key} transform={`translate(${p.pos.x}, ${p.pos.y})`}>
              {p.kind === "start" && (
                <>
                  <circle r="15" fill="var(--mb-accent)" stroke="#000" strokeWidth="3" />
                  <circle r="5" fill="var(--mb-on-accent)" />
                </>
              )}
              {p.kind === "hop" && (
                <>
                  <circle r="12" fill="var(--mb-accent-2)" stroke="#000" strokeWidth="3" />
                  <path
                    d="M -4 0 L -1 3 L 4 -3"
                    fill="none"
                    stroke="var(--mb-on-accent-2)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {p.kind === "detour" && (
                <>
                  <circle r="10" fill="var(--mb-danger)" stroke="#000" strokeWidth="2.5" />
                  <path
                    d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
                    stroke="var(--mb-on-danger)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              )}
              {p.kind === "destination" && (
                <>
                  <circle r="16" fill="var(--mb-gold)" stroke="#000" strokeWidth="3" />
                  <circle r="9" fill="none" stroke="var(--mb-on-gold)" strokeWidth="2.5" />
                  <circle r="3" fill="var(--mb-on-gold)" />
                </>
              )}
              <text
                textAnchor="middle"
                dy="34"
                fill="var(--mb-text)"
                fontSize="15"
                fontWeight="bold"
              >
                {p.name}
              </text>
              {p.kind === "detour" && p.distanceKm !== undefined && (
                <text
                  textAnchor="middle"
                  dy="52"
                  fill="var(--mb-danger)"
                  fontSize="14"
                  fontWeight="bold"
                >
                  {t("daily.detour.detourDistance", { distance: p.distanceKm })}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-2 text-[11px] font-bold leading-snug text-[var(--mb-text-dim)]">
        {t("daily.detour.map.caption")}
      </p>
    </section>
  );
}
