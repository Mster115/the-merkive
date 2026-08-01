"use client";
import * as React from "react";
import type { Translate } from "@merky/game-sdk";
import type { DetourSubmittedHop } from "./types";
import { getCityGeography } from "./cityGeography";

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
 * Rendered over a rough display of the city (waterways, parks, ring roads, arterials)
 * to give realistic geographic context for city navigation.
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

  // Fetch geographic features for the featured city (or procedural fallback)
  const cityGeo = React.useMemo(() => {
    return getCityGeography(
      cityName,
      undefined,
      startPoi.coordinates[0],
      startPoi.coordinates[1]
    );
  }, [cityName, startPoi.coordinates]);

  const projectInfo = React.useMemo(() => {
    const lats = plotted.map((p) => p.coordinates[0]);
    const lngs = plotted.map((p) => p.coordinates[1]);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    // Guard single-point case and pad frame for comfortable pin margin
    const latSpan = Math.max(maxLat - minLat, 0.012);
    const lngSpan = Math.max(maxLng - minLng, 0.012);
    minLat -= latSpan * 0.35;
    maxLat += latSpan * 0.35;
    minLng -= lngSpan * 0.35;
    maxLng += lngSpan * 0.35;

    // Longitude degrees narrow with latitude
    const lngScale = Math.max(
      Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180),
      0.01
    );
    const worldW = (maxLng - minLng) * lngScale;
    const worldH = maxLat - minLat;
    const scale = Math.min(VIEW_W / worldW, VIEW_H / worldH) * 0.8;
    const offsetX = (VIEW_W - worldW * scale) / 2;
    const offsetY = (VIEW_H - worldH * scale) / 2;

    const project = (coord: [number, number]) => ({
      x: offsetX + (coord[1] - minLng) * lngScale * scale,
      y: offsetY + (maxLat - coord[0]) * scale,
    });

    // 1 degree latitude ≈ 111 km
    const pxPerKm = (1 / 111) * scale;
    let scaleBarKm = 1;
    if (pxPerKm * 1 < 35) scaleBarKm = 5;
    if (pxPerKm * 5 < 35) scaleBarKm = 10;
    if (pxPerKm * 1 > 160) scaleBarKm = 0.5;
    const scaleBarPx = Math.min(Math.max(pxPerKm * scaleBarKm, 40), 160);

    return { project, scaleBarKm, scaleBarPx };
  }, [plotted]);

  const { project, scaleBarKm, scaleBarPx } = projectInfo;
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
                opacity="0.3"
              />
            </pattern>
          </defs>

          {/* Background surface & grid */}
          <rect width={VIEW_W} height={VIEW_H} fill="var(--mb-bg)" />
          <rect width={VIEW_W} height={VIEW_H} fill="url(#detour-grid)" />

          {/* City Geography: Parks & Greenery */}
          {cityGeo.polygons?.map((poly, idx) => {
            const pts = poly.points
              .map(project)
              .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(" ");
            return (
              <polygon
                key={`poly-${idx}`}
                points={pts}
                fill="#132a1e"
                stroke="#0b1711"
                strokeWidth="1.5"
                opacity="0.55"
              />
            );
          })}

          {/* City Geography: Rivers, Canals & Coastlines */}
          {cityGeo.polylines.map((poly, idx) => {
            if (poly.type !== "river" && poly.type !== "coastline") return null;
            const pathD = poly.points
              .map((pt, i) => {
                const p = project(pt);
                return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
              })
              .join(" ");

            const width = poly.width || 12;
            return (
              <g key={`water-${idx}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={width + 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#1a314d"
                  strokeWidth={width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2b4d75"
                  strokeWidth={Math.max(2, width - 6)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.5"
                />
              </g>
            );
          })}

          {/* City Geography: Ring Roads & Major Arterials */}
          {cityGeo.polylines.map((poly, idx) => {
            if (poly.type !== "ring_road" && poly.type !== "arterial") return null;
            const pathD = poly.points
              .map((pt, i) => {
                const p = project(pt);
                return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
              })
              .join(" ");

            const isRing = poly.type === "ring_road";
            return (
              <path
                key={`road-${idx}`}
                d={pathD}
                fill="none"
                stroke="var(--mb-line-dim)"
                strokeWidth={isRing ? "3.5" : "2"}
                strokeDasharray={isRing ? "8 5" : "none"}
                strokeLinecap="round"
                opacity={isRing ? "0.45" : "0.3"}
              />
            );
          })}

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

          {/* Markers */}
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

          {/* Cartographic Compass Rose (North Arrow) */}
          <g transform={`translate(${VIEW_W - 35}, 35)`}>
            <circle r="16" fill="var(--mb-surface-2)" stroke="#000" strokeWidth="2" />
            <path d="M 0 -10 L 4 3 L 0 0 L -4 3 Z" fill="var(--mb-danger)" stroke="#000" strokeWidth="1" />
            <path d="M 0 10 L 4 3 L 0 0 L -4 3 Z" fill="var(--mb-text-dim)" opacity="0.4" />
            <text x="0" y="-12" textAnchor="middle" fill="var(--mb-text)" fontSize="8" fontWeight="900">
              N
            </text>
          </g>

          {/* Cartographic Scale Bar */}
          <g transform={`translate(${VIEW_W - 140}, ${VIEW_H - 24})`}>
            <rect x="-8" y="-16" width={scaleBarPx + 16} height="22" rx="4" fill="var(--mb-surface)" stroke="#000" strokeWidth="1.5" opacity="0.9" />
            <line x1="0" y1="0" x2={scaleBarPx} y2="0" stroke="var(--mb-text)" strokeWidth="2.5" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="var(--mb-text)" strokeWidth="2.5" />
            <line x1={scaleBarPx} y1="-3" x2={scaleBarPx} y2="3" stroke="var(--mb-text)" strokeWidth="2.5" />
            <text x={scaleBarPx / 2} y="-5" textAnchor="middle" fill="var(--mb-text-dim)" fontSize="10" fontWeight="bold">
              {scaleBarKm >= 1 ? `${scaleBarKm} km` : `${scaleBarKm * 1000} m`}
            </text>
          </g>
        </svg>
      </div>

      <p className="mt-2 text-[11px] font-bold leading-snug text-[var(--mb-text-dim)]">
        {t("daily.detour.map.caption")}
      </p>
    </section>
  );
}

