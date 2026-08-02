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

export type MapLayerMode = "dark" | "satellite" | "streets" | "vector";

/**
 * Plots the trail the player has walked: start, hops, wrong turns, and destination.
 *
 * Supports fast-loading Web Mercator map tiles:
 * - Dark Transit & Streets (CartoDB Dark Matter)
 * - Satellite Imagery (Esri World Imagery)
 * - Light Street Map (CartoDB Positron)
 * - Vector Schematic (Procedural/preset vector fallback)
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
  const [layerMode, setLayerMode] = React.useState<MapLayerMode>("dark");
  const [zoomOffset, setZoomOffset] = React.useState<number>(0);

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

  // City geography presets/procedural features for vector fallback mode
  const cityGeo = React.useMemo(() => {
    return getCityGeography(
      cityName,
      undefined,
      startPoi.coordinates[0],
      startPoi.coordinates[1]
    );
  }, [cityName, startPoi.coordinates]);

  // Web Mercator & Bounding Box projection calculations
  const projection = React.useMemo(() => {
    const lats = plotted.map((p) => p.coordinates[0]);
    const lngs = plotted.map((p) => p.coordinates[1]);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    const latSpan = Math.max(maxLat - minLat, 0.012);
    const lngSpan = Math.max(maxLng - minLng, 0.012);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const latRad = (centerLat * Math.PI) / 180;
    // Calculate auto zoom level (clamped 10 to 16)
    const latZoom = Math.log2((VIEW_H * 360) / (latSpan * 2.2 * 256 * Math.cos(latRad)));
    const lngZoom = Math.log2((VIEW_W * 360) / (lngSpan * 2.2 * 256));
    const baseZoom = Math.floor(Math.min(latZoom, lngZoom));
    const z = Math.max(10, Math.min(16, baseZoom + zoomOffset));

    const tileCount = Math.pow(2, z);
    const worldSize = tileCount * 256;

    const latLngToMerc = (lat: number, lng: number) => {
      const x = ((lng + 180) / 360) * worldSize;
      const sin = Math.sin((lat * Math.PI) / 180);
      const clampedSin = Math.max(-0.9999, Math.min(0.9999, sin));
      const y =
        (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) *
        worldSize;
      return { x, y };
    };

    const centerMerc = latLngToMerc(centerLat, centerLng);
    const minMercX = centerMerc.x - VIEW_W / 2;
    const minMercY = centerMerc.y - VIEW_H / 2;

    const project = (coord: [number, number]) => {
      const merc = latLngToMerc(coord[0], coord[1]);
      return {
        x: merc.x - minMercX,
        y: merc.y - minMercY,
      };
    };

    // Calculate tile grid for raster layer
    const minTileX = Math.floor(minMercX / 256);
    const maxTileX = Math.floor((minMercX + VIEW_W) / 256);
    const minTileY = Math.floor(minMercY / 256);
    const maxTileY = Math.floor((minMercY + VIEW_H) / 256);

    const tiles: Array<{ key: string; url: string; x: number; y: number }> = [];

    if (layerMode !== "vector") {
      // Subdomain round-robin for CartoDB tile servers
      const subdomains = ["a", "b", "c", "d"];

      for (let tx = minTileX; tx <= maxTileX; tx++) {
        for (let ty = minTileY; ty <= maxTileY; ty++) {
          const wrappedTx = ((tx % tileCount) + tileCount) % tileCount;
          if (ty < 0 || ty >= tileCount) continue;

          const tilePxX = tx * 256 - minMercX;
          const tilePxY = ty * 256 - minMercY;
          const sub = subdomains[Math.abs(tx + ty) % subdomains.length]!;

          let url = "";
          if (layerMode === "dark") {
            url = `https://${sub}.basemaps.cartocdn.com/dark_all/${z}/${wrappedTx}/${ty}.png`;
          } else if (layerMode === "satellite") {
            url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${wrappedTx}`;
          } else if (layerMode === "streets") {
            url = `https://${sub}.basemaps.cartocdn.com/light_all/${z}/${wrappedTx}/${ty}.png`;
          }

          tiles.push({
            key: `${layerMode}-${z}-${tx}-${ty}`,
            url,
            x: tilePxX,
            y: tilePxY,
          });
        }
      }
    }

    // Scale bar calculation (pixels per meter at current latitude and zoom)
    const metersPerPixel = (156543.03392 * Math.cos(latRad)) / tileCount;
    let scaleBarMeters = 1000;
    let scaleBarPx = scaleBarMeters / metersPerPixel;

    if (scaleBarPx > 160) {
      scaleBarMeters = 500;
      scaleBarPx = scaleBarMeters / metersPerPixel;
    }
    if (scaleBarPx > 160) {
      scaleBarMeters = 200;
      scaleBarPx = scaleBarMeters / metersPerPixel;
    }
    if (scaleBarPx < 40) {
      scaleBarMeters = 2000;
      scaleBarPx = scaleBarMeters / metersPerPixel;
    }
    if (scaleBarPx < 40) {
      scaleBarMeters = 5000;
      scaleBarPx = scaleBarMeters / metersPerPixel;
    }
    scaleBarPx = Math.min(Math.max(scaleBarPx, 40), 160);

    return { project, tiles, z, scaleBarMeters, scaleBarPx };
  }, [plotted, layerMode, zoomOffset]);

  const { project, tiles, scaleBarMeters, scaleBarPx } = projection;
  const positions = plotted.map((p) => ({ ...p, pos: project(p.coordinates) }));
  const start = positions[0]!;
  const routePoints = positions.filter(
    (p) => p.kind === "start" || p.kind === "hop" || p.kind === "destination"
  );

  return (
    <section className="w-full overflow-hidden rounded-xl border-4 border-black bg-[var(--mb-bg-2)] p-3 text-[var(--mb-text)] shadow-[8px_8px_0_0_#000]">
      {/* Header controls bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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

        {/* Map Layer Switcher & Zoom Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border-2 border-black bg-[var(--mb-surface)] p-0.5 shadow-[2px_2px_0_0_#000]">
            <button
              type="button"
              onClick={() => setLayerMode("dark")}
              className={`rounded-md px-2 py-0.5 text-[11px] font-black transition-all ${
                layerMode === "dark"
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                  : "text-[var(--mb-text-dim)] hover:text-[var(--mb-text)]"
              }`}
            >
              🌆 Dark Transit
            </button>
            <button
              type="button"
              onClick={() => setLayerMode("satellite")}
              className={`rounded-md px-2 py-0.5 text-[11px] font-black transition-all ${
                layerMode === "satellite"
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                  : "text-[var(--mb-text-dim)] hover:text-[var(--mb-text)]"
              }`}
            >
              🛰️ Satellite
            </button>
            <button
              type="button"
              onClick={() => setLayerMode("streets")}
              className={`rounded-md px-2 py-0.5 text-[11px] font-black transition-all ${
                layerMode === "streets"
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                  : "text-[var(--mb-text-dim)] hover:text-[var(--mb-text)]"
              }`}
            >
              🗺️ Streets
            </button>
            <button
              type="button"
              onClick={() => setLayerMode("vector")}
              className={`rounded-md px-2 py-0.5 text-[11px] font-black transition-all ${
                layerMode === "vector"
                  ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                  : "text-[var(--mb-text-dim)] hover:text-[var(--mb-text)]"
              }`}
            >
              ✏️ Vector
            </button>
          </div>

          <div className="inline-flex rounded-lg border-2 border-black bg-[var(--mb-surface)] p-0.5 shadow-[2px_2px_0_0_#000]">
            <button
              type="button"
              onClick={() => setZoomOffset((prev) => Math.min(prev + 1, 2))}
              aria-label="Zoom in"
              className="rounded px-2 py-0.5 text-xs font-black text-[var(--mb-text)] hover:bg-[var(--mb-bg-2)]"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoomOffset((prev) => Math.max(prev - 1, -2))}
              aria-label="Zoom out"
              className="rounded px-2 py-0.5 text-xs font-black text-[var(--mb-text)] hover:bg-[var(--mb-bg-2)]"
            >
              -
            </button>
            {zoomOffset !== 0 && (
              <button
                type="button"
                onClick={() => setZoomOffset(0)}
                aria-label="Reset zoom"
                className="rounded px-1.5 py-0.5 text-[10px] font-black text-[var(--mb-accent)] hover:bg-[var(--mb-bg-2)]"
              >
                ⟲
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border-2 border-black bg-[#121212]">
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
                opacity="0.2"
              />
            </pattern>
          </defs>

          {/* Fallback background */}
          <rect width={VIEW_W} height={VIEW_H} fill="var(--mb-bg)" />

          {/* Raster Map Tiles (Dark Transit, Satellite, Light Streets) */}
          {layerMode !== "vector" &&
            tiles.map((tile) => (
              <image
                key={tile.key}
                href={tile.url}
                x={tile.x}
                y={tile.y}
                width="256"
                height="256"
                preserveAspectRatio="none"
              />
            ))}

          {/* Satellite overlay tone tint for visual contrast with markers */}
          {layerMode === "satellite" && (
            <rect
              width={VIEW_W}
              height={VIEW_H}
              fill="#000000"
              opacity="0.12"
              className="pointer-events-none"
            />
          )}

          {/* Vector Schematic Fallback Mode */}
          {layerMode === "vector" && (
            <>
              <rect width={VIEW_W} height={VIEW_H} fill="url(#detour-grid)" />

              {/* City Parks & Greenery */}
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

              {/* Rivers & Canals */}
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
                  </g>
                );
              })}

              {/* Secondary Grid Streets */}
              {cityGeo.polylines.map((poly, idx) => {
                if (poly.type !== "secondary") return null;
                const pathD = poly.points
                  .map((pt, i) => {
                    const p = project(pt);
                    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                  })
                  .join(" ");
                return (
                  <path
                    key={`sec-road-${idx}`}
                    d={pathD}
                    fill="none"
                    stroke="var(--mb-line-dim)"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.25"
                  />
                );
              })}

              {/* Ring Roads & Major Arterials */}
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

              {/* Feature Labels */}
              {cityGeo.labels?.map((lbl, idx) => {
                const p = project(lbl.coordinates);
                if (p.x < 15 || p.x > VIEW_W - 15 || p.y < 15 || p.y > VIEW_H - 15) return null;
                const isWater = lbl.kind === "water";
                const isPark = lbl.kind === "park";
                return (
                  <text
                    key={`lbl-${idx}`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    fill={isWater ? "#3867d6" : isPark ? "#26de81" : "var(--mb-text-dim)"}
                    fontSize="10"
                    fontWeight="900"
                    fontStyle={isWater ? "italic" : "normal"}
                    opacity="0.45"
                    className="select-none pointer-events-none uppercase tracking-wider"
                  >
                    {lbl.name}
                  </text>
                );
              })}
            </>
          )}

          {/* Route travelled connecting legs */}
          {routePoints.slice(1).map((pt, i) => {
            const prev = routePoints[i]!;
            return (
              <g key={`leg-g-${pt.key}`}>
                <line
                  x1={prev.pos.x}
                  y1={prev.pos.y}
                  x2={pt.pos.x}
                  y2={pt.pos.y}
                  stroke="#000000"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <line
                  x1={prev.pos.x}
                  y1={prev.pos.y}
                  x2={pt.pos.x}
                  y2={pt.pos.y}
                  stroke="var(--mb-accent-2)"
                  strokeWidth="5"
                  strokeDasharray="10 5"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Wrong turns branching off anchor */}
          {positions.map((p, i) => {
            if (p.kind !== "detour") return null;
            const anchor =
              [...positions.slice(0, i)]
                .reverse()
                .find((q) => q.kind !== "detour") ?? start;
            return (
              <g key={`detour-leg-g-${p.key}`}>
                <line
                  x1={anchor.pos.x}
                  y1={anchor.pos.y}
                  x2={p.pos.x}
                  y2={p.pos.y}
                  stroke="#000000"
                  strokeWidth="5"
                  opacity="0.6"
                />
                <line
                  x1={anchor.pos.x}
                  y1={anchor.pos.y}
                  x2={p.pos.x}
                  y2={p.pos.y}
                  stroke="var(--mb-danger)"
                  strokeWidth="3"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* Pin Markers & Labels */}
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
              {/* Text background badge for high legibility on map tiles */}
              <rect
                x={-Math.max(p.name.length * 4.5 + 8, 30)}
                y="20"
                width={Math.max(p.name.length * 9 + 16, 60)}
                height="22"
                rx="4"
                fill="var(--mb-surface)"
                stroke="#000"
                strokeWidth="2"
                opacity="0.92"
              />
              <text
                textAnchor="middle"
                dy="35"
                fill="var(--mb-text)"
                fontSize="13"
                fontWeight="900"
              >
                {p.name}
              </text>
              {p.kind === "detour" && p.distanceKm !== undefined && (
                <text
                  textAnchor="middle"
                  dy="54"
                  fill="var(--mb-danger)"
                  fontSize="13"
                  fontWeight="900"
                >
                  {t("daily.detour.detourDistance", { distance: p.distanceKm })}
                </text>
              )}
            </g>
          ))}

          {/* Cartographic Compass Rose (North Arrow) */}
          <g transform={`translate(${VIEW_W - 35}, 35)`}>
            <circle r="16" fill="var(--mb-surface)" stroke="#000" strokeWidth="2" />
            <path d="M 0 -10 L 4 3 L 0 0 L -4 3 Z" fill="var(--mb-danger)" stroke="#000" strokeWidth="1" />
            <path d="M 0 10 L 4 3 L 0 0 L -4 3 Z" fill="var(--mb-text-dim)" opacity="0.4" />
            <text x="0" y="-12" textAnchor="middle" fill="var(--mb-text)" fontSize="8" fontWeight="900">
              N
            </text>
          </g>

          {/* Cartographic Scale Bar */}
          <g transform={`translate(${VIEW_W - 140}, ${VIEW_H - 24})`}>
            <rect
              x="-8"
              y="-16"
              width={scaleBarPx + 16}
              height="22"
              rx="4"
              fill="var(--mb-surface)"
              stroke="#000"
              strokeWidth="2"
              opacity="0.92"
            />
            <line x1="0" y1="0" x2={scaleBarPx} y2="0" stroke="var(--mb-text)" strokeWidth="2.5" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="var(--mb-text)" strokeWidth="2.5" />
            <line x1={scaleBarPx} y1="-3" x2={scaleBarPx} y2="3" stroke="var(--mb-text)" strokeWidth="2.5" />
            <text x={scaleBarPx / 2} y="-5" textAnchor="middle" fill="var(--mb-text)" fontSize="10" fontWeight="900">
              {scaleBarMeters >= 1000 ? `${scaleBarMeters / 1000} km` : `${scaleBarMeters} m`}
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


