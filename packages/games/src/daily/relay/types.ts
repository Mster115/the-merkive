export interface RelayPayload {
  startWord: string;
  endWord: string;
  wordBank: string[];
  parMoves: number;
}

export interface RelayPublicState {
  startWord: string;
  endWord: string;
  wordBank: string[];
  chain: string[];
  usedWords: string[];
  movesUsed: number;
  startedAtMs: number;
  completedAtMs: number | null;
}
