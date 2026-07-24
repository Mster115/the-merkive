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

export type NexusCellStatus = "unanswered" | "correct" | "incorrect" | "revealed";

export interface NexusCellPublic {
  row: number;
  col: number;
  question: string;
  status: NexusCellStatus;
  answer?: string;
}

export interface NexusPublicState {
  rowLabels: [string, string, string];
  colLabels: [string, string, string];
  cells: NexusCellPublic[];
  score: number;
}
