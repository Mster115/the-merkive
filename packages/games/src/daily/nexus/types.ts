export interface NexusCellSpec {
  row: number;
  col: number;
  question: string;
  answer: string;
  acceptableAnswers: string[];
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

export interface NexusCellPublic {
  row: number;
  col: number;
  question: string;
  status: NexusCellStatus;
  answer?: string;
  /** Guesses made so far. Absent on attempts started before scoring changed. */
  attempts?: number;
  /** Points banked when this cell was answered correctly. */
  points?: number;
}

export interface NexusPublicState {
  rowLabels: [string, string, string];
  colLabels: [string, string, string];
  cells: NexusCellPublic[];
  /** Fractional since a retried cell is worth less than a whole point. */
  score: number;
}
