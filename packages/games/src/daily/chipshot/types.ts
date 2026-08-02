/**
 * Core geometry types for Chip Shot
 */
export interface Vec2 { x: number; y: number }

export type TileShape = 'straight' | 'corner' | 'dogleg' | 'open' | 'funnel';
export type ObstacleKind = 'wall' | 'bumper' | 'sand' | 'water' | 'windmill';

export interface WallSegment { a: Vec2; b: Vec2 }
export interface BumperData { center: Vec2; radius: number; bounce: number }
export interface ZoneData { points: Vec2[]; kind: 'sand' | 'water' }
export interface WindmillData { center: Vec2; armLength: number; rpm: number }

/**
 * Discriminated union for course obstacles
 */
export type Obstacle =
  | { kind: 'wall'; wall: WallSegment }
  | { kind: 'bumper'; bumper: BumperData }
  | { kind: 'sand'; zone: ZoneData }
  | { kind: 'water'; zone: ZoneData }
  | { kind: 'windmill'; windmill: WindmillData };

/**
 * Defines the geometry, hazards, and mechanics for a single hole
 */
export interface HoleLayout {
  index: number;
  shape: TileShape;
  walls: WallSegment[];
  obstacles: Obstacle[];
  tee: Vec2;
  cup: Vec2;
  cupRadius: number;
  par: number;
  bounds: { w: number; h: number };
}

/**
 * State of the player's ball
 */
export interface BallState {
  pos: Vec2;
  vel: Vec2;
  moving: boolean;
}

/**
 * Simulation result from taking a shot.
 * This is sent to the client so it can animate the ball smoothly without running full physics.
 */
export interface ShotResult {
  frames: Vec2[];              // ball position each physics tick
  outcome: 'stopped' | 'scored' | 'water';
  finalPos: Vec2;
}

export type ChipShotPhase = 'aiming' | 'rolling' | 'scored' | 'penalty' | 'done';

/**
 * Public State (broadcast to client — NO secrets ever)
 * Represents the complete visible game state at any given moment.
 */
export interface ChipShotPublicState {
  phase: ChipShotPhase;
  holeIndex: number;           // current hole (0-indexed)
  holes: HoleLayout[];         // full course geometry
  ball: BallState;
  lastShot: ShotResult | null; // for client animation replay
  strokes: number[];           // strokes per completed hole
  pars: number[];              // par per hole
  currentHoleStrokes: number;  // strokes on the active hole
}

/**
 * Secret State (server-only — never sent to any client)
 * Holds hidden mechanics or PRNG seeds to ensure pure deterministic simulation.
 */
export interface ChipShotSecretState {
  seed: string;
  maxStrokesPerHole: number;
}

/**
 * Content pack payload shape (what goes inside DailyContentPack.payload)
 * Settings generated daily.
 */
export interface ChipShotPayload {
  seed: string;
  holeCount: number;
  difficulty: 1 | 2 | 3;
  maxStrokesPerHole: number;
}

/**
 * Tile template for course generation
 */
export interface TileTemplate {
  shape: TileShape;
  walls: WallSegment[];                                  // boundary walls
  obstacleZones: { center: Vec2; radius: number }[];     // valid obstacle placement areas
  teeCandidates: Vec2[];                                 // possible tee positions
  cupCandidates: Vec2[];                                 // possible cup positions
}

/**
 * Physics event (internal to simulateShot)
 */
export type PhysicsEvent =
  | { type: 'scored' }
  | { type: 'wall_bounce' }
  | { type: 'bumper_bounce' }
  | { type: 'water_hazard' }
  | { type: 'sand_enter' }
  | { type: 'stopped' };
