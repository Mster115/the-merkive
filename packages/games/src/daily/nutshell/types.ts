export interface NutshellSlot {
  number: number;
  row: number;
  col: number;
  length: number;
  clue: string;
  answer: string;
}

export interface NutshellPayload {
  gridPattern: string[]; // 5 rows x 5 chars, "." = open cell, "#" = block
  across: NutshellSlot[];
  down: NutshellSlot[];
}

export interface NutshellPublicSlot {
  number: number;
  row: number;
  col: number;
  length: number;
  clue: string;
}

export interface NutshellCell {
  row: number;
  col: number;
  letter: string | null;
  blocked: boolean;
  checked?: boolean;
  correct?: boolean;
  revealed?: boolean;
}

export interface NutshellPublicState {
  grid: NutshellCell[][];
  across: NutshellPublicSlot[];
  down: NutshellPublicSlot[];
  checksUsed: number;
  revealsUsed: number;
  startedAtMs: number;
  completedAtMs: number | null;
}

export type NutshellSecretState = NutshellPayload;

export interface WordCandidate {
  word: string;
  clue: string;
}
