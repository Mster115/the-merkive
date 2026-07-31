export interface NexusCellSpec {
  row: number;
  col: number;
  question: string;
  answer: string;
  acceptableAnswers: string[];
  /**
   * Optional authored nudge — the first rung of the hint ladder, ahead of the
   * computed masks ("She won it twice, twenty years apart"). A cell without one
   * simply starts at the shape mask, so old packs need no backfill.
   */
  hint?: string;
}

export interface NexusPayload {
  rowLabels: [string, string, string];
  colLabels: [string, string, string];
  cells: NexusCellSpec[];
}

/**
 * A guess the grader turned down, kept server-side so "I answered that
 * correctly and it said no" can be checked against what players actually
 * typed instead of guessed at. Nothing here is ever broadcast: it lives in
 * `secretState`, which the play route strips before the response.
 */
export interface NexusMiss {
  row: number;
  col: number;
  guess: string;
}

/** Enough to see a pattern in one attempt, small enough that a player mashing
 *  the submit button can't inflate `daily_attempts.secret_state`. */
export const NEXUS_MAX_LOGGED_MISSES = 30;

/** The pack plus the server-only miss log accumulated while playing it. */
export interface NexusSecretState extends NexusPayload {
  misses?: NexusMiss[];
}

/**
 * `unanswered` covers a cell that has been guessed at and missed — it stays
 * open, it just costs less now. `incorrect` is terminal: the player gave up on
 * it, or the grid was submitted with it still open.
 */
export type NexusCellStatus = "unanswered" | "correct" | "incorrect" | "revealed";

/**
 * What a cell is worth, by the attempt it is answered on. Getting it first try
 * is a whole point; after the third miss the cell is worth nothing but stays
 * answerable, because filling the grid is its own reward and the alternative
 * is a locked square the player can only stare at.
 */
export const NEXUS_POINTS_BY_ATTEMPT = [1, 0.5, 0.25] as const;

export function pointsForAttempt(attemptIndex: number): number {
  return NEXUS_POINTS_BY_ATTEMPT[attemptIndex] ?? 0;
}

/**
 * Computed rungs on the hint ladder: the answer's shape, then its initials,
 * then every other letter. Three is where a hint stops being a nudge and
 * becomes `reveal_cell` with extra steps. A cell that also ships an authored
 * `hint` has one more rung ahead of these — see `hintCapFor`.
 */
export const NEXUS_MAX_HINTS = 3;

/** How many rungs this cell's ladder has, authored nudge included. */
export function hintCapFor(spec: { hint?: string }): number {
  return NEXUS_MAX_HINTS + (spec.hint && spec.hint.trim() !== "" ? 1 : 0);
}

export interface NexusCellPublic {
  row: number;
  col: number;
  question: string;
  status: NexusCellStatus;
  answer?: string;
  /** Guesses made so far. Absent on attempts started before scoring changed. */
  attempts?: number;
  /** Hints taken so far. Absent on attempts started before hints existed. */
  hints?: number;
  /** How many rungs this cell's ladder has. Absent on pre-hint attempts. */
  hintsAvailable?: number;
  /** The authored nudge, once the player has spent a step to unlock it. */
  hintText?: string;
  /**
   * The current hint rung, rendered as a mask of the answer ("C▢▢▢▢▢▢"). Safe
   * to broadcast: it is derived from the answer, never the answer itself
   * (except at the last rung on a very short word, which by then is worth
   * nothing).
   */
  hintMask?: string;
  /** Points banked when this cell was answered correctly. */
  points?: number;
}

/**
 * Where a cell sits on the scoring ladder. A hint costs exactly what a wrong
 * guess costs, so the two compound through one number rather than two parallel
 * penalties. `?? 0` on both: cells saved before either field existed must score
 * the way they did then, not as NaN.
 */
export function effectiveAttemptIndex(cell: {
  attempts?: number;
  hints?: number;
}): number {
  return (cell.attempts ?? 0) + (cell.hints ?? 0);
}

export interface NexusPublicState {
  rowLabels: [string, string, string];
  colLabels: [string, string, string];
  cells: NexusCellPublic[];
  /** Fractional since a retried cell is worth less than a whole point. */
  score: number;
}
