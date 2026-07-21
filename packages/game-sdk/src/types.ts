import type * as React from "react";

export type SeatIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Locale = "en";

export const SEAT_INDICES: readonly SeatIndex[] = [0, 1, 2, 3, 4, 5, 6, 7];

export interface SeatPublic {
  seatIndex: SeatIndex;
  displayName: string;
  avatarId: string;
  role: "player" | "spectator";
  connected: boolean;
  /** Left mid-game past the reconnect grace window; bots may cover this seat. */
  abandoned: boolean;
  isHost: boolean;
}

export interface TimerInfo {
  /** Epoch ms deadline. The server fires `onTick` at/after this moment. */
  endsAt: number;
  /** Game-defined label, e.g. "write", "vote", "turn". */
  kind: string;
  /** Original duration in ms, so UIs can render progress bars. */
  durationMs: number;
}

export type GameSettingField =
  | { key: string; labelKey: string; type: "boolean"; default: boolean }
  | { key: string; labelKey: string; type: "number"; default: number; min: number; max: number; step?: number }
  | { key: string; labelKey: string; type: "select"; default: string; options: { value: string; labelKey: string }[] }
  /** Rendered by the shell as a content-pack picker for this game. */
  | { key: string; labelKey: string; type: "pack"; default: string };

export interface GameMeta {
  /** Unique plugin id, e.g. "zaplash". */
  id: string;
  nameKey: string;
  descriptionKey: string;
  taglineKey?: string;
  minPlayers: number;
  /** Hard platform cap is 8. */
  maxPlayers: number;
  supportsSpectators: boolean;
  /** If true, a new player may replace an abandoned seat mid-match. */
  supportsMidGameJoin: boolean;
  tags: string[];
  defaultSettings: Record<string, unknown>;
  /** Drives the host's house-rules UI in the lobby. */
  settingFields: GameSettingField[];
}

export interface ContentPack {
  id: string;
  gameId: string;
  titleKey?: string;
  title?: string;
  locale: string;
  nsfw?: boolean;
  payload: unknown;
}

export interface GameContext {
  matchId: string;
  roomId: string;
  /** Players only (no spectators), sorted by seatIndex. */
  seats: SeatPublic[];
  /**
   * Effective settings: meta.defaultSettings overlaid with host choices.
   * If a "pack" setting is present, the server resolves it and injects the
   * full pack under `_pack` (a ContentPack) before calling into the game.
   */
  settings: Record<string, unknown>;
  /** Server clock, epoch ms. Never call Date.now() inside a game. */
  now: number;
  /**
   * Deterministic RNG in [0,1). Seeded from (match seed, state version), so
   * a given reduce call is replayable. Never use Math.random() in a game.
   */
  rng: () => number;
}

export interface GameStateIn {
  publicState: unknown;
  privateState: Partial<Record<SeatIndex, unknown>>;
  /**
   * Server-only game state. Never serialized into any client-bound payload
   * (match views, snapshots, patches) — the sanctioned home for information
   * no client may ever see: deck order/composition, hidden targets, pending
   * simultaneous inputs. Must be JSON-serializable; use `null` (never
   * `undefined`) for empty values inside it.
   */
  secretState?: unknown;
  phase: string;
}

export interface GameEvent {
  type: string;
  payload?: unknown;
}

export interface ReduceResult {
  /** Full replacement of the public state. */
  publicState: unknown;
  /** Per-seat FULL replacement; seats omitted keep their previous private state. */
  privateState?: Partial<Record<SeatIndex, unknown>>;
  /**
   * FULL replacement of the server-only secret state. Omit to keep the
   * previous value; any present value (including `null`) replaces it.
   * Never reaches any client.
   */
  secretState?: unknown;
  phase: string;
  /** CUMULATIVE match totals per seat; omitted seats keep their previous score. */
  scores?: Partial<Record<SeatIndex, number>>;
  /** Broadcast to clients for toasts/animations and appended to the audit log. */
  events: GameEvent[];
  /** New timer, `null` to clear, omit to keep the current timer running. */
  timer?: TimerInfo | null;
  matchOver?: boolean;
}

export interface ReduceError {
  error: string;
  code: string;
}

export function isReduceError(r: ReduceResult | ReduceError): r is ReduceError {
  return typeof r === "object" && r !== null && "error" in r;
}

export interface GameAction {
  type: string;
  seat: SeatIndex | "system";
  payload?: unknown;
}

/* ------------------------------------------------------------------ */
/* Client-facing views (what Stage/Controller components receive)      */
/* ------------------------------------------------------------------ */

export interface MatchView {
  id: string;
  gameId: string;
  phase: string;
  publicState: unknown;
  /** Effective settings the match was started with (incl. resolved `_pack`). */
  settings: Record<string, unknown>;
  scores: Partial<Record<SeatIndex, number>>;
  timer: TimerInfo | null;
  version: number;
  over: boolean;
}

export interface RoomView {
  code: string;
  status: "lobby" | "in_game" | "ended" | "expired";
  hostSeat: SeatIndex | null;
  gameId: string | null;
  settings: Record<string, unknown>;
  maxPlayers: number;
  /** Players only, sorted by seatIndex. */
  seats: SeatPublic[];
  spectatorCount: number;
  /** Podium data for the most recently finished match, if any. */
  lastMatch: {
    gameId: string;
    endedAt: number;
    scores: Partial<Record<SeatIndex, number>>;
    seats: { seatIndex: SeatIndex; displayName: string; avatarId: string }[];
  } | null;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type ActResult = { ok: true } | { ok: false; code: string; error: string };
export type ActFn = (type: string, payload?: unknown) => Promise<ActResult>;

export interface StageProps {
  room: RoomView;
  match: MatchView;
  t: Translate;
  /** Ticking client clock (epoch ms, ~2Hz) for countdowns. */
  now: number;
}

export interface ControllerProps {
  room: RoomView;
  match: MatchView;
  seat: SeatIndex;
  privateState: unknown;
  act: ActFn;
  t: Translate;
  now: number;
}

export interface LobbyOptionsProps {
  settings: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  disabled: boolean;
  t: Translate;
}

/* ------------------------------------------------------------------ */
/* The plugin contract                                                 */
/* ------------------------------------------------------------------ */

export interface GameModule {
  meta: GameMeta;
  /** All UI strings for this game, keyed `games.<id>.*`. Merged into the shell dictionary. */
  i18n: Partial<Record<Locale, Record<string, string>>>;
  /** Built-in content packs (optional; e.g. prompt packs for Zaplash). */
  packs?: ContentPack[];
  /** Create initial state when the host starts a match. */
  init(ctx: GameContext): ReduceResult;
  /** Validate + apply a player/system intent. Pure given (ctx, state, action). */
  reduce(ctx: GameContext, state: GameStateIn, action: GameAction): ReduceResult | ReduceError;
  /** Called by the server when the active timer has expired. Return null for no-op. */
  onTick?(ctx: GameContext, state: GameStateIn): ReduceResult | null;
  /** A seat left past the grace window. Return null for no-op. */
  onSeatAbandoned?(ctx: GameContext, state: GameStateIn, seat: SeatIndex): ReduceResult | null;
  /** An abandoned seat was reclaimed/replaced. Return null for no-op. */
  onSeatReplaced?(ctx: GameContext, state: GameStateIn, seat: SeatIndex): ReduceResult | null;
  /**
   * Seats whose input the game is waiting on right now. Drives bot coverage
   * of abandoned seats and "waiting on…" UI. Return [] when idle/over.
   */
  awaitedSeats(ctx: GameContext, state: GameStateIn): SeatIndex[];
  /** Bot move for an abandoned awaited seat. Return null to skip. */
  suggestBotAction?(
    ctx: GameContext,
    state: GameStateIn,
    seat: SeatIndex
  ): { type: string; payload?: unknown } | null;
  ui: {
    Stage: React.ComponentType<StageProps>;
    Controller: React.ComponentType<ControllerProps>;
    LobbyOptions?: React.ComponentType<LobbyOptionsProps>;
  };
}

/** Identity helper that pins the GameModule type for plugin authors. */
export function defineGame(mod: GameModule): GameModule {
  return mod;
}
