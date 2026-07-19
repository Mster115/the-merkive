import type {
  GameEvent,
  GameContext,
  GameModule,
  GameStateIn,
  ReduceError,
  ReduceResult,
  SeatIndex,
  SeatPublic,
  TimerInfo,
} from "./types";
import { isReduceError } from "./types";
import { matchRng } from "./rng";

/**
 * In-memory match harness that mirrors the server runtime's semantics
 * exactly: version increments per applied result, rng derives from
 * (seed, version), private state merges per-seat, scores are cumulative
 * totals, `timer: undefined` keeps the current timer.
 */
export interface TestMatch {
  game: GameModule;
  seats: SeatPublic[];
  settings: Record<string, unknown>;
  seed: string;
  now: number;
  version: number;
  state: GameStateIn;
  scores: Partial<Record<SeatIndex, number>>;
  timer: TimerInfo | null;
  over: boolean;
  log: GameEvent[];
}

const TEST_AVATARS = ["fox", "cat", "owl", "frog", "bear", "bee", "octopus", "crab"];

export function createTestMatch(
  game: GameModule,
  opts: {
    players: number | string[];
    settings?: Record<string, unknown>;
    seed?: string;
    now?: number;
  }
): TestMatch {
  const names = Array.isArray(opts.players)
    ? opts.players
    : Array.from({ length: opts.players }, (_, i) => `P${i}`);
  const seats: SeatPublic[] = names.map((n, i) => ({
    seatIndex: i as SeatIndex,
    displayName: n,
    avatarId: TEST_AVATARS[i % TEST_AVATARS.length]!,
    role: "player",
    connected: true,
    abandoned: false,
    isHost: i === 0,
  }));
  const m: TestMatch = {
    game,
    seats,
    settings: { ...game.meta.defaultSettings, ...(opts.settings ?? {}) },
    seed: opts.seed ?? "test-seed",
    now: opts.now ?? 1_750_000_000_000,
    version: 0,
    state: { publicState: null, privateState: {}, phase: "init" },
    scores: {},
    timer: null,
    over: false,
    log: [],
  };
  applyResult(m, game.init(ctxOf(m)));
  return m;
}

export function ctxOf(m: TestMatch): GameContext {
  return {
    matchId: "match-test",
    roomId: "room-test",
    seats: m.seats,
    settings: m.settings,
    now: m.now,
    rng: matchRng(m.seed, m.version),
  };
}

export function applyResult(m: TestMatch, r: ReduceResult): ReduceResult {
  m.state = {
    publicState: r.publicState,
    privateState: { ...m.state.privateState, ...(r.privateState ?? {}) },
    phase: r.phase,
  };
  if (r.scores) m.scores = { ...m.scores, ...r.scores };
  if (r.timer !== undefined) m.timer = r.timer;
  if (r.matchOver) m.over = true;
  m.log.push(...r.events);
  m.version += 1;
  return r;
}

/** Apply an action; throws if the game returns a ReduceError. */
export function act(
  m: TestMatch,
  seat: SeatIndex | "system",
  type: string,
  payload?: unknown
): ReduceResult {
  const r = m.game.reduce(ctxOf(m), m.state, { type, seat, payload });
  if (isReduceError(r)) {
    throw new Error(`reduce error [${r.code}] ${r.error} — action "${type}" by seat ${String(seat)} in phase "${m.state.phase}"`);
  }
  return applyResult(m, r);
}

/** Apply an action expecting rejection; throws if the game accepts it. */
export function actErr(
  m: TestMatch,
  seat: SeatIndex | "system",
  type: string,
  payload?: unknown
): ReduceError {
  const r = m.game.reduce(ctxOf(m), m.state, { type, seat, payload });
  if (!isReduceError(r)) {
    throw new Error(`expected error for action "${type}" by seat ${String(seat)}, but it was accepted (phase → "${r.phase}")`);
  }
  return r;
}

/** Advance the clock to the active timer's deadline and fire onTick. */
export function fireTimer(m: TestMatch): ReduceResult | null {
  if (!m.timer) throw new Error("fireTimer: no active timer");
  m.now = Math.max(m.now, m.timer.endsAt);
  const r = m.game.onTick?.(ctxOf(m), m.state) ?? null;
  if (r) applyResult(m, r);
  return r;
}

/** Mark a seat abandoned and run the game hook, mirroring the server. */
export function abandonSeat(m: TestMatch, seat: SeatIndex): ReduceResult | null {
  const s = m.seats.find((x) => x.seatIndex === seat);
  if (!s) throw new Error(`abandonSeat: no seat ${seat}`);
  s.abandoned = true;
  s.connected = false;
  const r = m.game.onSeatAbandoned?.(ctxOf(m), m.state, seat) ?? null;
  if (r) applyResult(m, r);
  return r;
}

/**
 * Run one round of bot coverage: for each awaited abandoned seat, apply
 * suggestBotAction. Returns the number of bot actions applied.
 */
export function botStep(m: TestMatch): number {
  const awaited = m.game.awaitedSeats(ctxOf(m), m.state);
  let applied = 0;
  for (const seat of awaited) {
    const s = m.seats.find((x) => x.seatIndex === seat);
    if (!s?.abandoned) continue;
    const bot = m.game.suggestBotAction?.(ctxOf(m), m.state, seat);
    if (!bot) continue;
    act(m, seat, bot.type, bot.payload);
    applied++;
  }
  return applied;
}
