import type {
  GameContext,
  GameAction,
  GameStateIn,
  GameEvent,
  ReduceResult,
  ReduceError,
  SeatIndex,
} from "@merky/game-sdk";
import { YOUGOTIT_CORE_SPECTRA, YOUGOTIT_FALLBACK_CLUES, type Spectrum } from "./packs";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TeamId = "bass" | "treble";
export type StealDir = "left" | "right";

export const CLUE_SECONDS = 75;
export const STEAL_SECONDS = 30;
export const REVEAL_SECONDS = 7;
export const TARGET_MIN = 24;
export const TARGET_MAX = 156;
export const CLUE_MAX_LEN = 60;

export interface UndercutOutcome {
  votes: { left: number; right: number };
  /** Direction with the most votes; null on tie or zero votes. */
  majority: StealDir | null;
  /** True direction of the target from the pointer; null when dead-on. */
  correct: StealDir | null;
  awarded: boolean;
  toTeam: TeamId | null;
}

export interface LastTurnSummary {
  turnNumber: number;
  activeTeam: TeamId;
  oracleSeat: SeatIndex;
  prompt: Spectrum;
  clue: string;
  clueWasAuto: boolean;
  pointerAngle: number;
  targetAngle: number;
  points: number;
  /** Null when the Undercut was skipped (disabled or nobody to vote). */
  undercut: UndercutOutcome | null;
  /** Bullseye while still strictly trailing — same team rides again. */
  catchUp: boolean;
}

export interface YougotitPublicState {
  teams: { bass: SeatIndex[]; treble: SeatIndex[] };
  /** Cumulative team totals (Treble starts at 1 — first-mover comp). */
  teamScores: { bass: number; treble: number };
  targetScore: number;
  stealEnabled: boolean;
  turnNumber: number;
  activeTeam: TeamId;
  oracleSeat: SeatIndex;
  prompt: Spectrum;
  clue: string | null;
  clueWasAuto: boolean;
  pointerAngle: number;
  readySeats: SeatIndex[];
  stealVotes: { left: number; right: number };
  stealVotedSeats: SeatIndex[];
  /**
   * THE SECRET. Present ONLY during "reveal" and "game_over". During
   * clue/guess/steal the current target lives solely in the Oracle's
   * per-seat privateState — publicState is broadcast to every client.
   */
  targetAngle?: number;
  winnerTeam?: TeamId;
  /** Finished-turn summary (already-revealed data only). */
  lastTurn: LastTurnSummary | null;
  _promptPool: Spectrum[];
  _usedPrompts: Spectrum[];
  _oracleCursor: { bass: number; treble: number };
}

export interface YougotitPrivateState {
  /** Only ever set for the current Oracle's seat. */
  targetAngle?: number;
  /** Only ever set for opposing-team seats during the Undercut. */
  undercutDir?: StealDir;
}

export interface YougotitSettings {
  targetScore: number;
  stealEnabled: boolean;
  guessSeconds: number;
  packId: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function getSettings(ctx: GameContext): YougotitSettings {
  const raw = ctx.settings.targetScore;
  const parsed =
    typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : 10;
  return {
    targetScore: Number.isFinite(parsed) && parsed > 0 ? parsed : 10,
    stealEnabled: Boolean(ctx.settings.stealEnabled ?? true),
    guessSeconds:
      typeof ctx.settings.guessSeconds === "number" ? ctx.settings.guessSeconds : 90,
    packId: typeof ctx.settings.packId === "string" ? ctx.settings.packId : "yougotit-core",
  };
}

function isSpectrum(x: unknown): x is Spectrum {
  if (typeof x !== "object" || x === null) return false;
  const rec = x as Record<string, unknown>;
  return typeof rec.left === "string" && typeof rec.right === "string";
}

/** Prompts from the resolved `_pack` payload, falling back to the core list. */
export function getPromptPool(ctx: GameContext): Spectrum[] {
  const pack = ctx.settings._pack as { payload?: { prompts?: unknown } } | undefined;
  const prompts = pack?.payload?.prompts;
  if (Array.isArray(prompts)) {
    const valid = prompts.filter(isSpectrum);
    if (valid.length > 0) return valid;
  }
  return YOUGOTIT_CORE_SPECTRA;
}

export function shuffle<T>(array: readonly T[], rng: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

export function otherTeam(team: TeamId): TeamId {
  return team === "bass" ? "treble" : "bass";
}

export function teamOf(pub: YougotitPublicState, seat: SeatIndex): TeamId | null {
  if (pub.teams.bass.includes(seat)) return "bass";
  if (pub.teams.treble.includes(seat)) return "treble";
  return null;
}

function isAbandoned(ctx: GameContext, seat: SeatIndex): boolean {
  return ctx.seats.find((s) => s.seatIndex === seat)?.abandoned === true;
}

/** Active-team members (minus the Oracle) who are still expected to guess. */
export function eligibleGuessers(ctx: GameContext, pub: YougotitPublicState): SeatIndex[] {
  return pub.teams[pub.activeTeam].filter(
    (s) => s !== pub.oracleSeat && !isAbandoned(ctx, s)
  );
}

/** Opposing-team members still expected to cast an Undercut vote. */
export function eligibleStealVoters(ctx: GameContext, pub: YougotitPublicState): SeatIndex[] {
  return pub.teams[otherTeam(pub.activeTeam)].filter((s) => !isAbandoned(ctx, s));
}

/**
 * Frozen dial math: five 9°-wide zones centered on the target.
 * |Δ| ≤ 4.5 → 4, ≤ 13.5 → 3, ≤ 22.5 → 2, else 0.
 */
export function zonePoints(delta: number): 0 | 2 | 3 | 4 {
  const d = Math.abs(delta);
  if (d <= 4.5) return 4;
  if (d <= 13.5) return 3;
  if (d <= 22.5) return 2;
  return 0;
}

/** Integer target angle, uniform in [24, 156]. */
export function sampleTargetAngle(rng: () => number): number {
  const span = TARGET_MAX - TARGET_MIN + 1;
  return Math.min(TARGET_MAX, TARGET_MIN + Math.floor(rng() * span));
}

function pickFallbackClue(ctx: GameContext): string {
  const idx = Math.floor(ctx.rng() * YOUGOTIT_FALLBACK_CLUES.length);
  return YOUGOTIT_FALLBACK_CLUES[idx] ?? YOUGOTIT_FALLBACK_CLUES[0] ?? "TOTAL MERKY VIBES";
}

/** Per-seat cumulative scores: every seat mirrors its own team's total. */
function seatScores(pub: YougotitPublicState): Partial<Record<SeatIndex, number>> {
  const out: Partial<Record<SeatIndex, number>> = {};
  for (const s of pub.teams.bass) out[s] = pub.teamScores.bass;
  for (const s of pub.teams.treble) out[s] = pub.teamScores.treble;
  return out;
}

/** Round-robin oracle pick in seat order, skipping abandoned seats. */
function pickOracle(
  ctx: GameContext,
  members: SeatIndex[],
  cursor: number
): { oracle: SeatIndex; nextCursor: number } {
  const n = members.length;
  for (let i = 0; i < n; i++) {
    const idx = (cursor + i) % n;
    const seat = members[idx];
    if (seat !== undefined && !isAbandoned(ctx, seat)) {
      return { oracle: seat, nextCursor: (idx + 1) % n };
    }
  }
  // Everyone on the team is abandoned — pick anyway; the bot covers the clue.
  const idx = n > 0 ? cursor % n : 0;
  const seat = members[idx] ?? members[0];
  return { oracle: (seat ?? 0) as SeatIndex, nextCursor: n > 0 ? (idx + 1) % n : 0 };
}

/* ------------------------------------------------------------------ */
/* Turn lifecycle                                                      */
/* ------------------------------------------------------------------ */

type TurnCarry = Pick<
  YougotitPublicState,
  | "teams"
  | "teamScores"
  | "turnNumber"
  | "lastTurn"
  | "_promptPool"
  | "_usedPrompts"
  | "_oracleCursor"
>;

function startTurn(
  ctx: GameContext,
  prev: TurnCarry,
  team: TeamId,
  catchUp: boolean
): ReduceResult {
  const settings = getSettings(ctx);
  const { oracle, nextCursor } = pickOracle(ctx, prev.teams[team], prev._oracleCursor[team]);

  // Draw a prompt — no repeats until the pool runs dry, then reshuffle used.
  let pool = [...prev._promptPool];
  let used = [...prev._usedPrompts];
  if (pool.length === 0) {
    const source = used.length > 0 ? used : getPromptPool(ctx);
    pool = shuffle(source, ctx.rng);
    used = [];
  }
  const prompt = pool[0] ?? getPromptPool(ctx)[0] ?? { left: "Less", right: "More" };
  const remainingPool = pool.slice(1);
  const nextUsed = [...used, prompt];

  const targetAngle = sampleTargetAngle(ctx.rng);

  const nextCursorMap = { ...prev._oracleCursor };
  nextCursorMap[team] = nextCursor;

  // NOTE: built explicitly (never spread from a reveal-phase state) so the
  // `targetAngle` key cannot leak into a hidden-information phase.
  const publicState: YougotitPublicState = {
    teams: prev.teams,
    teamScores: prev.teamScores,
    targetScore: settings.targetScore,
    stealEnabled: settings.stealEnabled,
    turnNumber: prev.turnNumber + 1,
    activeTeam: team,
    oracleSeat: oracle,
    prompt,
    clue: null,
    clueWasAuto: false,
    pointerAngle: 90,
    readySeats: [],
    stealVotes: { left: 0, right: 0 },
    stealVotedSeats: [],
    lastTurn: prev.lastTurn,
    _promptPool: remainingPool,
    _usedPrompts: nextUsed,
    _oracleCursor: nextCursorMap,
  };

  // SECURITY: full per-seat wipe every turn. Only the new Oracle carries the
  // target; everyone else's stale private data (old targets, old Undercut
  // votes) is cleared.
  const privateState: Partial<Record<SeatIndex, YougotitPrivateState>> = {};
  for (const s of ctx.seats) {
    privateState[s.seatIndex] = s.seatIndex === oracle ? { targetAngle } : {};
  }

  const ms = CLUE_SECONDS * 1000;
  return {
    publicState,
    privateState,
    phase: "clue",
    scores: seatScores(publicState),
    events: [
      {
        type: "turn_started",
        payload: { turnNumber: publicState.turnNumber, activeTeam: team, oracleSeat: oracle, catchUp },
      },
    ],
    timer: { endsAt: ctx.now + ms, kind: "clue", durationMs: ms },
  };
}

export function initYougotit(ctx: GameContext): ReduceResult {
  // Shuffle seats, deal alternating — Bass gets the extra on odd counts.
  const shuffledSeats = shuffle(
    ctx.seats.map((s) => s.seatIndex),
    ctx.rng
  );
  const bass: SeatIndex[] = [];
  const treble: SeatIndex[] = [];
  shuffledSeats.forEach((seat, i) => {
    (i % 2 === 0 ? bass : treble).push(seat);
  });
  bass.sort((a, b) => a - b);
  treble.sort((a, b) => a - b);

  const initialPool = shuffle(getPromptPool(ctx), ctx.rng);

  return startTurn(
    ctx,
    {
      teams: { bass, treble },
      // Treble starts with 1 point — first-mover compensation (Bass opens).
      teamScores: { bass: 0, treble: 1 },
      turnNumber: 0,
      lastTurn: null,
      _promptPool: initialPool,
      _usedPrompts: [],
      _oracleCursor: { bass: 0, treble: 0 },
    },
    "bass",
    false
  );
}

/* ------------------------------------------------------------------ */
/* Phase transitions                                                   */
/* ------------------------------------------------------------------ */

function beginGuess(
  ctx: GameContext,
  pub: YougotitPublicState,
  clue: string,
  auto: boolean,
  privMap: Partial<Record<SeatIndex, unknown>>
): ReduceResult {
  const settings = getSettings(ctx);
  const nextPub: YougotitPublicState = { ...pub, clue, clueWasAuto: auto };
  const events: GameEvent[] = [{ type: "clue_submitted", payload: { auto } }];

  // Every possible guesser is gone — lock the pointer where it sits (90).
  if (eligibleGuessers(ctx, nextPub).length === 0) {
    return afterGuess(ctx, nextPub, privMap, events);
  }

  const ms = settings.guessSeconds * 1000;
  return {
    publicState: nextPub,
    phase: "guess",
    events,
    timer: { endsAt: ctx.now + ms, kind: "guess", durationMs: ms },
  };
}

function afterGuess(
  ctx: GameContext,
  pub: YougotitPublicState,
  privMap: Partial<Record<SeatIndex, unknown>>,
  events: GameEvent[]
): ReduceResult {
  const settings = getSettings(ctx);
  if (settings.stealEnabled && eligibleStealVoters(ctx, pub).length > 0) {
    const ms = STEAL_SECONDS * 1000;
    return {
      publicState: { ...pub, stealVotes: { left: 0, right: 0 }, stealVotedSeats: [] },
      phase: "steal",
      events: [...events, { type: "undercut_started" }],
      timer: { endsAt: ctx.now + ms, kind: "steal", durationMs: ms },
    };
  }
  return beginReveal(ctx, pub, privMap, events, null);
}

function resolveSteal(
  ctx: GameContext,
  pub: YougotitPublicState,
  privMap: Partial<Record<SeatIndex, unknown>>,
  events: GameEvent[]
): ReduceResult {
  const oraclePriv = privMap[pub.oracleSeat] as YougotitPrivateState | undefined;
  const target = typeof oraclePriv?.targetAngle === "number" ? oraclePriv.targetAngle : 90;

  const { left, right } = pub.stealVotes;
  const majority: StealDir | null = left > right ? "left" : right > left ? "right" : null;
  const correct: StealDir | null =
    target < pub.pointerAngle ? "left" : target > pub.pointerAngle ? "right" : null;
  const awarded = majority !== null && correct !== null && majority === correct;

  const undercut: UndercutOutcome = {
    votes: { left, right },
    majority,
    correct,
    awarded,
    toTeam: awarded ? otherTeam(pub.activeTeam) : null,
  };
  return beginReveal(ctx, pub, privMap, events, undercut);
}

function beginReveal(
  ctx: GameContext,
  pub: YougotitPublicState,
  privMap: Partial<Record<SeatIndex, unknown>>,
  events: GameEvent[],
  undercut: UndercutOutcome | null
): ReduceResult {
  const oraclePriv = privMap[pub.oracleSeat] as YougotitPrivateState | undefined;
  const targetAngle = typeof oraclePriv?.targetAngle === "number" ? oraclePriv.targetAngle : 90;

  const points = zonePoints(pub.pointerAngle - targetAngle);
  const active = pub.activeTeam;
  const opposing = otherTeam(active);

  const teamScores = { ...pub.teamScores };
  teamScores[active] += points;
  if (undercut?.awarded) teamScores[opposing] += 1;

  const catchUp = points === 4 && teamScores[active] < teamScores[opposing];

  const lastTurn: LastTurnSummary = {
    turnNumber: pub.turnNumber,
    activeTeam: active,
    oracleSeat: pub.oracleSeat,
    prompt: pub.prompt,
    clue: pub.clue ?? "",
    clueWasAuto: pub.clueWasAuto,
    pointerAngle: pub.pointerAngle,
    targetAngle,
    points,
    undercut,
    catchUp,
  };

  const nextPub: YougotitPublicState = { ...pub, targetAngle, teamScores, lastTurn };
  const ms = REVEAL_SECONDS * 1000;
  return {
    publicState: nextPub,
    phase: "reveal",
    scores: seatScores(nextPub),
    events: [
      ...events,
      {
        type: "turn_revealed",
        payload: {
          targetAngle,
          points,
          undercutAwarded: undercut?.awarded ?? false,
          catchUp,
        },
      },
    ],
    timer: { endsAt: ctx.now + ms, kind: "reveal", durationMs: ms },
  };
}

function finishOrNextTurn(ctx: GameContext, pub: YougotitPublicState): ReduceResult {
  const settings = getSettings(ctx);
  const { bass, treble } = pub.teamScores;
  const reached = bass >= settings.targetScore || treble >= settings.targetScore;

  // Win only with a clear lead — a tie at/over the target is sudden death.
  if (reached && bass !== treble) {
    const winnerTeam: TeamId = bass > treble ? "bass" : "treble";
    const nextPub: YougotitPublicState = { ...pub, winnerTeam };
    return {
      publicState: nextPub,
      phase: "game_over",
      scores: seatScores(nextPub),
      events: [{ type: "game_over", payload: { winnerTeam } }],
      timer: null,
      matchOver: true,
    };
  }

  const catchUp = pub.lastTurn?.catchUp === true;
  const nextTeam = catchUp ? pub.activeTeam : otherTeam(pub.activeTeam);
  return startTurn(ctx, pub, nextTeam, catchUp);
}

/* ------------------------------------------------------------------ */
/* Reduce                                                              */
/* ------------------------------------------------------------------ */

export function reduceYougotit(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = state.publicState as YougotitPublicState | null;
  if (!pub) return { error: "State not initialized", code: "invalid_state" };

  if (action.type === "submit_clue") {
    if (state.phase !== "clue") {
      return { error: "Clues are closed right now", code: "bad_phase" };
    }
    if (action.seat === "system" || action.seat !== pub.oracleSeat) {
      return { error: "Only the Oracle gives the clue", code: "not_oracle" };
    }
    const payload = action.payload as { text?: unknown } | undefined;
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (text.length === 0) {
      return { error: "Clue cannot be empty", code: "empty_clue" };
    }
    if (text.length > CLUE_MAX_LEN) {
      return { error: `Clue must be ${CLUE_MAX_LEN} characters or fewer`, code: "too_long" };
    }
    return beginGuess(ctx, pub, text, false, state.privateState);
  }

  if (action.type === "move_pointer") {
    if (state.phase !== "guess") {
      return { error: "The dial is locked right now", code: "bad_phase" };
    }
    if (action.seat === "system") {
      return { error: "Only guessing teammates can move the dial", code: "not_guesser" };
    }
    const seat = action.seat;
    if (teamOf(pub, seat) !== pub.activeTeam || seat === pub.oracleSeat) {
      return { error: "Only guessing teammates can move the dial", code: "not_guesser" };
    }
    const payload = action.payload as { angle?: unknown } | undefined;
    const angle = payload?.angle;
    if (typeof angle !== "number" || !Number.isInteger(angle) || angle < 0 || angle > 180) {
      return { error: "Angle must be a whole number from 0 to 180", code: "invalid_angle" };
    }
    // Last write wins; broadcast live. No event — the state patch is enough.
    return {
      publicState: { ...pub, pointerAngle: angle },
      phase: "guess",
      events: [],
    };
  }

  if (action.type === "lock_pointer") {
    if (state.phase !== "guess") {
      return { error: "Nothing to lock right now", code: "bad_phase" };
    }
    if (action.seat === "system") {
      return { error: "Only guessing teammates can lock the dial", code: "not_guesser" };
    }
    const seat = action.seat;
    if (teamOf(pub, seat) !== pub.activeTeam || seat === pub.oracleSeat) {
      return { error: "Only guessing teammates can lock the dial", code: "not_guesser" };
    }
    if (pub.readySeats.includes(seat)) {
      return { error: "You already locked in", code: "already_locked" };
    }
    const readySeats = [...pub.readySeats, seat];
    const nextPub: YougotitPublicState = { ...pub, readySeats };
    const events: GameEvent[] = [{ type: "pointer_locked", payload: { seat } }];

    const guessers = eligibleGuessers(ctx, nextPub);
    if (guessers.every((s) => readySeats.includes(s))) {
      return afterGuess(ctx, nextPub, state.privateState, events);
    }
    return { publicState: nextPub, phase: "guess", events };
  }

  if (action.type === "guess_direction") {
    if (state.phase !== "steal") {
      return { error: "The Undercut is not open", code: "bad_phase" };
    }
    if (action.seat === "system") {
      return { error: "Only the opposing team can undercut", code: "not_opponent" };
    }
    const seat = action.seat;
    if (teamOf(pub, seat) !== otherTeam(pub.activeTeam)) {
      return { error: "Only the opposing team can undercut", code: "not_opponent" };
    }
    const payload = action.payload as { dir?: unknown } | undefined;
    const dir = payload?.dir;
    if (dir !== "left" && dir !== "right") {
      return { error: "Direction must be left or right", code: "invalid_direction" };
    }

    // Overwrite allowed until the phase closes — move the old vote if any.
    const prevPriv = state.privateState[seat] as YougotitPrivateState | undefined;
    const prevDir = prevPriv?.undercutDir;
    const stealVotes = { ...pub.stealVotes };
    if (prevDir === "left") stealVotes.left = Math.max(0, stealVotes.left - 1);
    if (prevDir === "right") stealVotes.right = Math.max(0, stealVotes.right - 1);
    stealVotes[dir] += 1;

    const stealVotedSeats = pub.stealVotedSeats.includes(seat)
      ? pub.stealVotedSeats
      : [...pub.stealVotedSeats, seat];
    const nextPub: YougotitPublicState = { ...pub, stealVotes, stealVotedSeats };
    const votePriv: YougotitPrivateState = { undercutDir: dir };
    const nextPrivMap = { ...state.privateState, [seat]: votePriv };
    const events: GameEvent[] = [{ type: "undercut_voted", payload: { seat } }];

    const voters = eligibleStealVoters(ctx, nextPub);
    if (voters.every((s) => stealVotedSeats.includes(s))) {
      const result = resolveSteal(ctx, nextPub, nextPrivMap, events);
      return {
        ...result,
        privateState: { ...(result.privateState ?? {}), [seat]: votePriv },
      };
    }
    return {
      publicState: nextPub,
      privateState: { [seat]: votePriv },
      phase: "steal",
      events,
    };
  }

  return { error: "Unknown action type", code: "unknown_action" };
}

/* ------------------------------------------------------------------ */
/* Timers, abandonment, bots                                           */
/* ------------------------------------------------------------------ */

export function onTickYougotit(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as YougotitPublicState | null;
  if (!pub) return null;

  if (state.phase === "clue") {
    // Oracle froze — auto-clue from the built-in fallback list.
    return beginGuess(ctx, pub, pickFallbackClue(ctx), true, state.privateState);
  }
  if (state.phase === "guess") {
    return afterGuess(ctx, pub, state.privateState, [
      { type: "guess_locked", payload: { auto: true } },
    ]);
  }
  if (state.phase === "steal") {
    return resolveSteal(ctx, pub, state.privateState, []);
  }
  if (state.phase === "reveal") {
    return finishOrNextTurn(ctx, pub);
  }
  return null;
}

export function awaitedSeatsYougotit(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as YougotitPublicState | null;
  if (!pub) return [];

  // The Oracle stays awaited even when abandoned — the bot covers the clue.
  if (state.phase === "clue") return [pub.oracleSeat];
  if (state.phase === "guess") {
    return eligibleGuessers(ctx, pub).filter((s) => !pub.readySeats.includes(s));
  }
  if (state.phase === "steal") {
    return eligibleStealVoters(ctx, pub).filter((s) => !pub.stealVotedSeats.includes(s));
  }
  return [];
}

export function suggestBotActionYougotit(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): { type: string; payload?: unknown } | null {
  const pub = state.publicState as YougotitPublicState | null;
  if (!pub) return null;

  if (state.phase === "clue" && seat === pub.oracleSeat) {
    return { type: "submit_clue", payload: { text: pickFallbackClue(ctx) } };
  }
  if (
    state.phase === "guess" &&
    teamOf(pub, seat) === pub.activeTeam &&
    seat !== pub.oracleSeat &&
    !pub.readySeats.includes(seat)
  ) {
    return { type: "lock_pointer" };
  }
  if (
    state.phase === "steal" &&
    teamOf(pub, seat) === otherTeam(pub.activeTeam) &&
    !pub.stealVotedSeats.includes(seat)
  ) {
    return { type: "guess_direction", payload: { dir: ctx.rng() < 0.5 ? "left" : "right" } };
  }
  return null;
}

export function onSeatAbandonedYougotit(
  ctx: GameContext,
  state: GameStateIn,
  _seat: SeatIndex
): ReduceResult | null {
  const pub = state.publicState as YougotitPublicState | null;
  if (!pub) return null;

  // Oracle abandoned mid-clue: stay in clue — awaitedSeats keeps the Oracle
  // listed and the server's bot coverage submits a fallback clue.
  if (state.phase === "guess") {
    const guessers = eligibleGuessers(ctx, pub);
    if (guessers.length === 0 || guessers.every((s) => pub.readySeats.includes(s))) {
      return afterGuess(ctx, pub, state.privateState, [
        { type: "guess_locked", payload: { auto: true } },
      ]);
    }
  }
  if (state.phase === "steal") {
    const voters = eligibleStealVoters(ctx, pub);
    if (voters.length === 0 || voters.every((s) => pub.stealVotedSeats.includes(s))) {
      return resolveSteal(ctx, pub, state.privateState, []);
    }
  }
  return null;
}
