export interface MerkMiniSlot {
  number: number;
  row: number;
  col: number;
  length: number;
  clue: string;
  answer: string;
}

export interface MerkMiniPayload {
  gridPattern: string[]; // 5 rows x 5 chars, "." = open cell, "#" = block
  across: MerkMiniSlot[];
  down: MerkMiniSlot[];
}

export interface MerkMiniPublicSlot {
  number: number;
  row: number;
  col: number;
  length: number;
  clue: string;
}

export interface MerkMiniCell {
  row: number;
  col: number;
  letter: string | null;
  blocked: boolean;
  checked?: boolean;
  correct?: boolean;
  revealed?: boolean;
}

export interface MerkMiniPublicState {
  grid: MerkMiniCell[][];
  across: MerkMiniPublicSlot[];
  down: MerkMiniPublicSlot[];
  checksUsed: number;
  revealsUsed: number;
  startedAtMs: number;
  completedAtMs: number | null;
}

export type MerkMiniSecretState = MerkMiniPayload;

export interface WordCandidate {
  word: string;
  clue: string;
}
