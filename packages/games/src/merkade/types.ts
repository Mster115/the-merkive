import type { SeatIndex } from "@merky/game-sdk";

export type RoundFormat = "fib" | "doodle" | "majority";

export interface MerkadePublicState {
  roundPlan: RoundFormat[];
  roundIndex: number;
  phase: string;
  // --- fib_answer ---
  fibFact?: string;
  fibSubmittedCount?: number;
  // --- fib_vote ---
  fibOptions?: string[];
  // --- fib_reveal ---
  fibReveal?: {
    truthIndex: number;
    options: string[];
    voteCounts: number[];
    votesBySeat: Partial<Record<SeatIndex, number>>;
    authorsBySeat: Partial<Record<SeatIndex, number>>;
    roundScores: Partial<Record<SeatIndex, number>>;
  };
  // --- doodle_draw ---
  doodleArtistOrder?: SeatIndex[];
  doodleSubmittedCount?: number;
  // --- doodle_guess / doodle_vote / doodle_reveal_one ---
  doodleSpotlightIndex?: number;
  doodleCurrentArtist?: SeatIndex;
  doodleCurrentGrid?: number[][];
  doodleGuessOptions?: string[];
  doodleReveal?: {
    truthIndex: number;
    options: string[];
    voteCounts: number[];
    votesBySeat: Partial<Record<SeatIndex, number>>;
    authorsBySeat: Partial<Record<SeatIndex, number>>;
    artist: SeatIndex;
    roundScores: Partial<Record<SeatIndex, number>>;
  };
  // --- majority_answer ---
  majorityPrompt?: string;
  majorityOptions?: [string, string];
  majoritySubmittedCount?: number;
  // --- majority_reveal ---
  majorityReveal?: {
    counts: [number, number];
    majorityOptionIndex: 0 | 1;
    choicesBySeat: Partial<Record<SeatIndex, 0 | 1>>;
    predictionsBySeat: Partial<Record<SeatIndex, 0 | 1>>;
    roundScores: Partial<Record<SeatIndex, number>>;
  };
}

export interface MerkadePrivateState {
  // fib_answer
  fibHasSubmitted?: boolean;
  // doodle_draw
  doodleWord?: string;
  doodleHasSubmitted?: boolean;
  // doodle_guess (non-artist seats only)
  doodleHasGuessed?: boolean;
  // doodle_vote
  doodleHasVoted?: boolean;
  // fib_vote
  fibHasVoted?: boolean;
  // majority_answer
  majorityHasSubmitted?: boolean;
}

export interface MerkadeSecretState {
  totals: Partial<Record<SeatIndex, number>>;
  fib?: {
    fact: string;
    truth: string;
    decoysBySeat: Partial<Record<SeatIndex, string>>;
    options?: string[];
    truthIndex?: number;
    authorsBySeat?: Partial<Record<SeatIndex, number>>;
    votesBySeat: Partial<Record<SeatIndex, number>>;
  } | null;
  doodle?: {
    wordsBySeat: Partial<Record<SeatIndex, string>>;
    gridsBySeat: Partial<Record<SeatIndex, number[][]>>;
    guessesBySeat: Partial<Record<SeatIndex, string>>;
    options?: string[];
    truthIndex?: number;
    authorsBySeat?: Partial<Record<SeatIndex, number>>;
    votesForCurrent: Partial<Record<SeatIndex, number>>;
  } | null;
  majority?: {
    prompt: string;
    options: [string, string];
    choicesBySeat: Partial<Record<SeatIndex, 0 | 1>>;
    predictionsBySeat: Partial<Record<SeatIndex, 0 | 1>>;
  } | null;
}

export interface MerkadeSettings {
  roundCount: number;
  answerSeconds: number;
  voteSeconds: number;
  drawSeconds: number;
  guessSeconds: number;
  pack: string;
}
