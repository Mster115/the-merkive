import type {
  Vec2,
  ShotResult,
  HoleLayout,
  WallSegment,
  Obstacle,
  BumperData,
  ZoneData,
  PhysicsEvent,
} from "./types";

/** Physics constants — exported for tests. */
export const MAX_SPEED = 12;
export const FRICTION = 0.985;
export const MIN_SPEED = 0.08;
export const WALL_DAMPEN = 0.7;
export const SAND_FRICTION = 0.95;
export const CUP_SPEED_THRESHOLD = 3.5;
export const BALL_RADIUS = 6;
export const MAX_TICKS = 600;
export const DT = 1 / 60;

/** Vector math helpers */
export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = vec2Sub(b, a);
  const ap = vec2Sub(p, a);
  const abLenSq = vec2Dot(ab, ab);
  if (abLenSq === 0) return { x: a.x, y: a.y };

  let t = vec2Dot(ap, ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return vec2Add(a, vec2Scale(ab, t));
}

/** Calculate true perpendicular normal vector of line segment AB pointing towards ballPos. */
export function wallNormal(p1: Vec2, p2: Vec2, ballPos: Vec2): Vec2 {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 1 };

  let nx = -dy / len;
  let ny = dx / len;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const toBallX = ballPos.x - midX;
  const toBallY = ballPos.y - midY;

  if (nx * toBallX + ny * toBallY < 0) {
    nx = -nx;
    ny = -ny;
  }

  return { x: nx, y: ny };
}

/** Reflect velocity off a wall segment. Returns new velocity or null if no collision. */
export function wallCollision(
  pos: Vec2,
  vel: Vec2,
  wall: WallSegment,
  ballRadius: number
): { pos: Vec2; vel: Vec2 } | null {
  const p1 = wall.a;
  const p2 = wall.b;
  if (!p1 || !p2) return null;

  const closest = closestPointOnSegment(pos, p1, p2);
  const diff = vec2Sub(pos, closest);
  const dist = vec2Length(diff);

  if (dist < ballRadius) {
    const normal = wallNormal(p1, p2, pos);
    const dot = vec2Dot(vel, normal);

    if (dot < 0) {
      const newVel = vec2Sub(vel, vec2Scale(normal, 2 * dot));
      const newPos = vec2Add(closest, vec2Scale(normal, ballRadius + 0.5));
      return { pos: newPos, vel: vec2Scale(newVel, WALL_DAMPEN) };
    }
  }
  return null;
}

/** Check circle-circle bumper collision. Returns new velocity or null. */
export function bumperCollision(
  pos: Vec2,
  vel: Vec2,
  bumperCenter: Vec2,
  bumperRadius: number,
  bounceFactor: number,
  ballRadius: number
): { pos: Vec2; vel: Vec2 } | null {
  const diff = vec2Sub(pos, bumperCenter);
  const dist = vec2Length(diff);
  const minDist = bumperRadius + ballRadius;

  if (dist < minDist) {
    const normal = dist === 0 ? { x: 0, y: 1 } : vec2Scale(diff, 1 / dist);
    const dot = vec2Dot(vel, normal);

    if (dot < 0) {
      const newVel = vec2Sub(vel, vec2Scale(normal, 2 * dot));
      const newPos = vec2Add(bumperCenter, vec2Scale(normal, minDist + 0.5));
      return { pos: newPos, vel: vec2Scale(newVel, bounceFactor) };
    }
  }
  return null;
}

/** Check if point is inside a polygon (for sand/water zones). */
export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (pi && pj) {
      const intersect =
        pi.y > point.y !== pj.y > point.y &&
        point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

/** Simulate an entire shot to completion with sub-stepping for smooth physics. */
export function simulateShot(
  startPos: Vec2,
  angle: number,
  power: number,
  hole: HoleLayout
): ShotResult {
  let pos = { x: startPos.x, y: startPos.y };
  let vel = {
    x: Math.cos(angle) * power * MAX_SPEED,
    y: Math.sin(angle) * power * MAX_SPEED,
  };

  const frames: Vec2[] = [{ ...pos }];

  // Collect all wall segments (boundary walls + obstacle walls)
  const allWalls: WallSegment[] = [...hole.walls];
  const bumpers: BumperData[] = [];
  const zones: ZoneData[] = [];

  for (const obs of hole.obstacles) {
    if (obs.kind === "wall") {
      allWalls.push(obs.wall);
    } else if (obs.kind === "bumper") {
      bumpers.push(obs.bumper);
    } else if (obs.kind === "sand" || obs.kind === "water") {
      zones.push(obs.zone);
    }
  }

  const SUB_STEPS = 4;
  const SUB_DT = (DT * 60) / SUB_STEPS;
  const SUB_FRICTION = Math.pow(FRICTION, 1 / SUB_STEPS);

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    for (let sub = 0; sub < SUB_STEPS; sub++) {
      // a. Apply velocity to position
      pos = vec2Add(pos, vec2Scale(vel, SUB_DT));

      // b. Apply friction
      vel = vec2Scale(vel, SUB_FRICTION);

      // c. Check wall collisions
      for (const wall of allWalls) {
        const result = wallCollision(pos, vel, wall, BALL_RADIUS);
        if (result) {
          pos = result.pos;
          vel = result.vel;
        }
      }

      // d. Check bumper collisions
      for (const bumper of bumpers) {
        const result = bumperCollision(
          pos,
          vel,
          bumper.center,
          bumper.radius,
          bumper.bounce,
          BALL_RADIUS
        );
        if (result) {
          pos = result.pos;
          vel = result.vel;
        }
      }

      // e, f. Check zone collisions
      for (const zone of zones) {
        if (pointInPolygon(pos, zone.points)) {
          if (zone.kind === "sand") {
            vel = vec2Scale(vel, Math.pow(SAND_FRICTION, 1 / SUB_STEPS));
          } else if (zone.kind === "water") {
            frames.push({ ...pos });
            return {
              outcome: "water",
              finalPos: { ...pos },
              frames,
            };
          }
        }
      }

      // g. Check cup
      const cupDiff = vec2Sub(pos, hole.cup);
      const cupDist = vec2Length(cupDiff);
      const speed = vec2Length(vel);

      if (cupDist < hole.cupRadius && speed < CUP_SPEED_THRESHOLD) {
        frames.push({ ...pos });
        return {
          outcome: "scored",
          finalPos: { ...pos },
          frames,
        };
      }
    }

    // Record frame after sub-steps
    frames.push({ ...pos });

    const speed = vec2Length(vel);
    // h. Check stop
    if (speed < MIN_SPEED) {
      return {
        outcome: "stopped",
        finalPos: { ...pos },
        frames,
      };
    }
  }

  // Max ticks reached
  return {
    outcome: "stopped",
    finalPos: { ...pos },
    frames,
  };
}
