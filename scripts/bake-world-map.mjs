/**
 * Bake a world coastline into a static equirectangular SVG path.
 *
 * Waypoint's map must work offline, add no runtime dependency, and sit inside
 * the neo-brutalist palette, so the coastline ships as a string constant
 * (`packages/games/src/daily/waypoint/worldMap.ts`) rather than as a map
 * library plus tile fetches. This script is the one-off that produces it.
 *
 *   curl -sLO https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json
 *   node scripts/bake-world-map.mjs land-110m.json 0.4 1.2 world-path.txt
 *
 * Args: <topojson> [tolerance=0.4] [minRingArea=1.2] [outFile]
 * Tolerance is Douglas-Peucker in degrees. At 0.4 the coastline error is under
 * two pixels at the widths this renders at, and the output is ~22KB.
 *
 * Source data is Natural Earth (public domain) via the world-atlas package.
 */
import { readFileSync, writeFileSync } from "node:fs";

const topo = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { scale, translate } = topo.transform;

// Arcs are quantized + delta-encoded.
function decodeArc(arc) {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
}
const arcs = topo.arcs.map(decodeArc);

function ring(indices) {
  const pts = [];
  for (const i of indices) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    // Shared endpoint between consecutive arcs must not be duplicated.
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
}

// Equirectangular into a 360x180 viewBox (lon -180..180 -> 0..360, lat 90..-90 -> 0..180).
const project = ([lon, lat]) => [lon + 180, 90 - lat];

// Douglas-Peucker in projected space; tolerance in viewBox units (degrees).
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sqTol = tol * tol;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0, idx = -1;
    const [x1, y1] = pts[first], [x2, y2] = pts[last];
    const dx = x2 - x1, dy = y2 - y1;
    const denom = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = pts[i];
      let t = denom ? ((px - x1) * dx + (py - y1) * dy) / denom : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = x1 + t * dx - px, ey = y1 + t * dy - py;
      const sq = ex * ex + ey * ey;
      if (sq > maxSq) { maxSq = sq; idx = i; }
    }
    if (maxSq > sqTol && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const TOL = Number(process.argv[3] ?? 0.5);
const MIN_AREA = Number(process.argv[4] ?? 1.2); // drop specks smaller than this

function shoelace(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
}

const root = topo.objects.land;
const geoms =
  root.type === "GeometryCollection" ? root.geometries : [root];
const polygons = [];
for (const g of geoms) {
  if (g.type === "MultiPolygon") polygons.push(...g.arcs);
  else if (g.type === "Polygon") polygons.push(g.arcs);
}

const round = (n) => Math.round(n * 10) / 10;
const parts = [];
let kept = 0, dropped = 0;

// Clip to the inhabited band. Antarctica is a huge visual mass that no
// landmark ever sits on, and its ring closes along the projection edge, which
// is what draws the stray horizontal rules across the map.
const LAT_MIN = -58;
const LAT_MAX = 84;

/**
 * Longitudes come back wrapped into [-180,180], so a ring crossing the
 * antimeridian (Eurasia does) looks like it jumps the full width of the map.
 * Unwrap into a continuous run, then emit the ring at each 360° offset that
 * still touches the viewBox and let the SVG clip decide what is visible.
 */
function unwrap(geo) {
  let prev = geo[0][0];
  let shift = 0;
  return geo.map(([lon, lat], i) => {
    if (i > 0) {
      const d = lon - prev;
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
      prev = lon;
    }
    return [lon + shift, lat];
  });
}

for (const poly of polygons) {
  for (const r of poly) {
    const geo = unwrap(ring(r));
    const lats = geo.map(([, lat]) => lat);
    if (Math.max(...lats) < LAT_MIN || Math.min(...lats) > LAT_MAX) { dropped++; continue; }

    const pts = simplify(geo.map(project), TOL);
    if (pts.length < 4) { dropped++; continue; }
    if (shoelace(pts) < MIN_AREA) { dropped++; continue; }

    const xs = pts.map(([x]) => x);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    let emitted = false;
    for (const dx of [-360, 0, 360]) {
      if (hi + dx < 0 || lo + dx > 360) continue;
      emitted = true;
      parts.push(
        "M" +
          pts.map(([x, y]) => `${round(x + dx)} ${round(y)}`).join("L") +
          "Z"
      );
    }
    if (emitted) kept++; else dropped++;
  }
}

const d = parts.join("");
writeFileSync(process.argv[5] ?? "world-path.txt", d);
console.error(
  `rings kept=${kept} dropped=${dropped} tol=${TOL} minArea=${MIN_AREA} chars=${d.length} (${(d.length / 1024).toFixed(1)} KB)`
);
