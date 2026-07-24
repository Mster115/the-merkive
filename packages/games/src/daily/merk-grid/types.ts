export interface MerkGridCellSpec {
  row: number;
  col: number;
  question: string;
  answer: string;
  acceptableAnswers: string[];
}

export interface MerkGridPayload {
  rowLabels: [string, string, string];
  colLabels: [string, string, string];
  cells: MerkGridCellSpec[];
}

export type MerkGridCellStatus = "unanswered" | "correct" | "incorrect" | "revealed";

export interface MerkGridCellPublic {
  row: number;
  col: number;
  question: string;
  status: MerkGridCellStatus;
  answer?: string;
}

export interface MerkGridPublicState {
  rowLabels: [string, string, string];
  colLabels: [string, string, string];
  cells: MerkGridCellPublic[];
  score: number;
}
