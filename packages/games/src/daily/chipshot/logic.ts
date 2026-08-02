/**
 * Chip Shot — Pure game logic: init / reduce / summarize.
 *
 * Every function here is pure and deterministic — no Math.random(), no
 * Date.now(), no I/O, no mutation of incoming state. Use ctx.rng / ctx.now
 * only.
 */

import type {
  DailyContext,
  DailyStateIn,
  DailyReduceResult,
  DailyReduceError,
  DailySummary,
  DailyContentPack,
  DailyAction,
} from "../types";
import type {
  ChipShotPublicState,
  ChipShotSecretState,
  ChipShotPayload,
  ChipShotPhase,
  HoleLayout,
  Vec2,
  TileShape,
  Obstacle,
} from "./types";
import { getTile } from "./tiles";
import { simulateShot } from "./physics";

// ── Constants ───────────────────────────────────────────────────────────────

const TILE_SHAPES: readonly TileShape[] = [
  "straight",
  "corner",
  "dogleg",
  "open",
  "funnel",
];

const CUP_RADIUS = 12;

const OBSTACLE_COUNTS: Record<1 | 2 | 3, { min: number; max: number }> = {
  1: { min: 1, max: 2 },
  2: { min: 2, max: 4 },
  3: { min: 3, max: 5 },
};

const PAR_BASE = 2;
const PAR_PER_OBSTACLE = 0.5;

// ── RNG Helper ──────────────────────────────────────────────────────────────

/** Pick a random integer in [min, max] inclusive using ctx.rng. */
function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random item from an array using ctx.rng. */
function rngPick<T>(rng: () => number, arr: readonly T[]): T {
  const idx = Math.floor(rng() * arr.length);
  // noUncheckedIndexedAccess: arr[idx] could be undefined if arr is empty,
  // but we only call this with non-empty arrays.
  return arr[idx]!;
}

// ── Course Generation ───────────────────────────────────────────────────────

/** Generate a random obstacle at a position using ctx.rng. */
function generateObstacle(rng: () => number, center: Vec2): Obstacle {
  const roll = rng();
  if (roll < 0.35) {
    // Wall obstacle — short segment near the center
    const angle = rng() * Math.PI * 2;
    const halfLen = 20 + rng() * 30;
    return {
      kind: "wall",
      wall: {
        a: {
          x: center.x + Math.cos(angle) * halfLen,
          y: center.y + Math.sin(angle) * halfLen,
        },
        b: {
          x: center.x - Math.cos(angle) * halfLen,
          y: center.y - Math.sin(angle) * halfLen,
        },
      },
    };
  } else if (roll < 0.6) {
    // Bumper
    return {
      kind: "bumper",
      bumper: {
        center,
        radius: 10 + rng() * 8,
        bounce: 1.2 + rng() * 0.6,
      },
    };
  } else if (roll < 0.8) {
    // Sand zone — small square polygon around center
    const size = 25 + rng() * 20;
    return {
      kind: "sand",
      zone: {
        points: [
          { x: center.x - size, y: center.y - size },
          { x: center.x + size, y: center.y - size },
          { x: center.x + size, y: center.y + size },
          { x: center.x - size, y: center.y + size },
        ],
        kind: "sand",
      },
    };
  } else {
    // Water hazard — small square polygon
    const size = 20 + rng() * 15;
    return {
      kind: "water",
      zone: {
        points: [
          { x: center.x - size, y: center.y - size },
          { x: center.x + size, y: center.y - size },
          { x: center.x + size, y: center.y + size },
          { x: center.x - size, y: center.y + size },
        ],
        kind: "water",
      },
    };
  }
}

/** Generate a single hole layout from a tile template and obstacles. */
function generateHole(
  rng: () => number,
  index: number,
  difficulty: 1 | 2 | 3,
): HoleLayout {
  const shape = rngPick(rng, TILE_SHAPES);
  const template = getTile(shape);

  // Pick tee and cup positions — ensure they're different candidates
  const tee = rngPick(rng, template.teeCandidates);
  const cupCandidates = template.cupCandidates.filter(
    (c) => Math.abs(c.x - tee.x) + Math.abs(c.y - tee.y) > 100,
  );
  const cup =
    cupCandidates.length > 0
      ? rngPick(rng, cupCandidates)
      : rngPick(rng, template.cupCandidates);

  // Generate obstacles in obstacle zones
  const counts = OBSTACLE_COUNTS[difficulty];
  const obstacleCount = rngInt(rng, counts.min, counts.max);
  const obstacles: Obstacle[] = [];

  for (let i = 0; i < obstacleCount && i < template.obstacleZones.length; i++) {
    const zone = template.obstacleZones[i]!;
    // Offset the obstacle within the zone
    const offsetX = (rng() - 0.5) * zone.radius * 0.8;
    const offsetY = (rng() - 0.5) * zone.radius * 0.8;
    const center: Vec2 = {
      x: zone.center.x + offsetX,
      y: zone.center.y + offsetY,
    };
    obstacles.push(generateObstacle(rng, center));
  }

  // Calculate par: base + distance factor + obstacle factor
  const dx = cup.x - tee.x;
  const dy = cup.y - tee.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const distancePar = dist > 250 ? 1 : 0;
  const obstaclePar = Math.floor(obstacles.length * PAR_PER_OBSTACLE);
  const par = Math.max(2, PAR_BASE + distancePar + obstaclePar + (difficulty - 1));

  return {
    index,
    shape,
    walls: [...template.walls],
    obstacles,
    tee,
    cup,
    cupRadius: CUP_RADIUS,
    par,
    bounds: { w: 400, h: 400 },
  };
}

/** Generate a full course from content pack parameters. */
export function generateCourse(
  rng: () => number,
  payload: ChipShotPayload,
): HoleLayout[] {
  const holes: HoleLayout[] = [];
  for (let i = 0; i < payload.holeCount; i++) {
    holes.push(generateHole(rng, i, payload.difficulty));
  }
  return holes;
}

// ── init ────────────────────────────────────────────────────────────────────

/** Splits the content pack into initial public/secret state. Server-only. */
export function init(
  ctx: DailyContext,
  pack: DailyContentPack,
): { publicState: unknown; secretState: unknown; phase: string } {
  const payload = pack.payload as ChipShotPayload;
  const holes = generateCourse(ctx.rng, payload);
  const firstHole = holes[0];

  if (!firstHole) {
    // Should never happen if validatePack ensures holeCount >= 1
    return {
      publicState: {
        phase: "done" as ChipShotPhase,
        holeIndex: 0,
        holes: [],
        ball: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, moving: false },
        lastShot: null,
        strokes: [],
        pars: [],
        currentHoleStrokes: 0,
      } satisfies ChipShotPublicState,
      secretState: {
        seed: payload.seed,
        maxStrokesPerHole: payload.maxStrokesPerHole,
      } satisfies ChipShotSecretState,
      phase: "done",
    };
  }

  const publicState: ChipShotPublicState = {
    phase: "aiming",
    holeIndex: 0,
    holes,
    ball: {
      pos: { x: firstHole.tee.x, y: firstHole.tee.y },
      vel: { x: 0, y: 0 },
      moving: false,
    },
    lastShot: null,
    strokes: [],
    pars: holes.map((h) => h.par),
    currentHoleStrokes: 0,
  };

  const secretState: ChipShotSecretState = {
    seed: payload.seed,
    maxStrokesPerHole: payload.maxStrokesPerHole,
  };

  return { publicState, secretState, phase: "aiming" };
}

// ── reduce ──────────────────────────────────────────────────────────────────

/** Validate + apply a player action. Pure. Never throws. */
export function reduce(
  _ctx: DailyContext,
  state: DailyStateIn,
  action: DailyAction,
): DailyReduceResult | DailyReduceError {
  const pub = state.publicState as ChipShotPublicState;
  const sec = state.secretState as ChipShotSecretState;

  switch (action.type) {
    case "shoot":
      return handleShoot(pub, sec, action.payload);
    case "next_hole":
      return handleNextHole(pub);
    case "reset_after_penalty":
      return handleResetAfterPenalty(pub);
    default:
      return { error: `unknown action type: ${action.type}`, code: "unknown_action" };
  }
}

function handleShoot(
  pub: ChipShotPublicState,
  sec: ChipShotSecretState,
  payload: unknown,
): DailyReduceResult | DailyReduceError {
  if (pub.phase !== "aiming") {
    return { error: "can only shoot in aiming phase", code: "invalid_phase" };
  }

  const p = payload as { angle?: unknown; power?: unknown } | undefined;
  if (!p || typeof p.angle !== "number" || typeof p.power !== "number") {
    return { error: "shoot requires angle and power numbers", code: "invalid_payload" };
  }

  const { angle, power } = p;

  if (!Number.isFinite(angle)) {
    return { error: "angle must be a finite number", code: "invalid_angle" };
  }
  if (power < 0 || power > 1 || !Number.isFinite(power)) {
    return { error: "power must be between 0 and 1", code: "invalid_power" };
  }

  const currentHole = pub.holes[pub.holeIndex];
  if (!currentHole) {
    return { error: "no current hole", code: "invalid_state" };
  }

  // Run deterministic physics simulation
  const shotResult = simulateShot(pub.ball.pos, angle, power, currentHole);

  // The shot itself always costs a stroke. A water hazard adds the
  // traditional stroke-and-distance penalty on top of that.
  let newStrokes = pub.currentHoleStrokes + 1;
  if (shotResult.outcome === "water") {
    newStrokes += 1;
  }

  // Determine new phase based on shot outcome
  let newPhase: ChipShotPhase;
  if (shotResult.outcome === "scored") {
    newPhase = "scored";
  } else if (shotResult.outcome === "water") {
    // Still subject to the stroke cap — a hole doesn't play forever.
    newPhase = newStrokes >= sec.maxStrokesPerHole ? "scored" : "penalty";
  } else {
    // Ball stopped — check if max strokes reached
    if (newStrokes >= sec.maxStrokesPerHole) {
      newPhase = "scored"; // Force advance to next hole
    } else {
      newPhase = "aiming";
    }
  }

  const newBall = {
    pos: { x: shotResult.finalPos.x, y: shotResult.finalPos.y },
    vel: { x: 0, y: 0 },
    moving: false,
  };

  const newPublicState: ChipShotPublicState = {
    ...pub,
    phase: newPhase,
    ball: newBall,
    lastShot: shotResult,
    currentHoleStrokes: newStrokes,
  };

  return {
    publicState: newPublicState,
    phase: newPhase,
    events: [{ type: "shot", payload: { outcome: shotResult.outcome } }],
  };
}

function handleNextHole(
  pub: ChipShotPublicState,
): DailyReduceResult | DailyReduceError {
  if (pub.phase !== "scored") {
    return { error: "can only advance after scoring", code: "invalid_phase" };
  }

  const completedStrokes = [...pub.strokes, pub.currentHoleStrokes];
  const nextHoleIndex = pub.holeIndex + 1;

  // Check if this was the last hole
  if (nextHoleIndex >= pub.holes.length) {
    const finalState: ChipShotPublicState = {
      ...pub,
      phase: "done",
      strokes: completedStrokes,
      lastShot: null,
      currentHoleStrokes: 0,
    };
    return {
      publicState: finalState,
      phase: "done",
      events: [],
      attemptOver: true,
    };
  }

  // Advance to next hole
  const nextHole = pub.holes[nextHoleIndex]!;
  const nextState: ChipShotPublicState = {
    ...pub,
    phase: "aiming",
    holeIndex: nextHoleIndex,
    ball: {
      pos: { x: nextHole.tee.x, y: nextHole.tee.y },
      vel: { x: 0, y: 0 },
      moving: false,
    },
    lastShot: null,
    strokes: completedStrokes,
    currentHoleStrokes: 0,
  };

  return {
    publicState: nextState,
    phase: "aiming",
    events: [],
  };
}

function handleResetAfterPenalty(
  pub: ChipShotPublicState,
): DailyReduceResult | DailyReduceError {
  if (pub.phase !== "penalty") {
    return { error: "can only reset after a penalty", code: "invalid_phase" };
  }

  const currentHole = pub.holes[pub.holeIndex];
  if (!currentHole) {
    return { error: "no current hole", code: "invalid_state" };
  }

  // Reset ball to tee position for this hole
  const resetState: ChipShotPublicState = {
    ...pub,
    phase: "aiming",
    ball: {
      pos: { x: currentHole.tee.x, y: currentHole.tee.y },
      vel: { x: 0, y: 0 },
      moving: false,
    },
    lastShot: null,
  };

  return {
    publicState: resetState,
    phase: "aiming",
    events: [],
  };
}

// ── summarize ───────────────────────────────────────────────────────────────

/** Pure derivation of status, share text, and stats. */
export function summarize(
  _ctx: DailyContext,
  state: DailyStateIn,
): DailySummary {
  const pub = state.publicState as ChipShotPublicState;
  const isDone = pub.phase === "done";

  const totalStrokes = pub.strokes.reduce((sum, s) => sum + s, 0);
  const totalPar = pub.pars.reduce((sum, p) => sum + p, 0);
  const diff = totalStrokes - totalPar;

  let diffText: string;
  if (diff < 0) {
    diffText = `${Math.abs(diff)} under par`;
  } else if (diff > 0) {
    diffText = `${diff} over par`;
  } else {
    diffText = "even par";
  }

  // Hole-in-ones count & badge
  const holeInOnes = pub.strokes.filter((s) => s === 1).length;
  const hioBadge =
    holeInOnes > 0
      ? ` • 🎯 ${holeInOnes} Hole-in-One${holeInOnes > 1 ? "s" : ""}!`
      : "";

  // Detailed per-hole breakdown lines
  const holeDetails = pub.strokes
    .map((strokes, i) => {
      const par = pub.pars[i] ?? 3;
      if (strokes === 1) return `• Hole ${i + 1}: ⛳ HOLE IN ONE! (1/${par})`;
      if (strokes < par) return `• Hole ${i + 1}: 🎯 Birdie (${strokes}/${par})`;
      if (strokes === par) return `• Hole ${i + 1}: 🏌️ Par (${strokes}/${par})`;
      return `• Hole ${i + 1}: 🔴 ${strokes} strokes (${strokes}/${par})`;
    })
    .join("\n");

  const shareText = isDone
    ? `Chip Shot • ${totalStrokes} strokes (${diffText})${hioBadge}\n${holeDetails}`
    : `Chip Shot • in progress`;

  return {
    status: isDone ? "solved" : "in_progress",
    shareText,
    stats: {
      completed: isDone,
      score: totalStrokes,
      extra: {
        holes: pub.holes.length,
        par: totalPar,
        holeInOnes,
        strokes: pub.strokes.join(","),
      },
    },
  };
}
