export interface MerkChainPayload {
  startWord: string;
  endWord: string;
  wordBank: string[];
  parMoves: number;
}

export interface MerkChainPublicState {
  startWord: string;
  endWord: string;
  wordBank: string[];
  chain: string[];
  usedWords: string[];
  movesUsed: number;
  startedAtMs: number;
  completedAtMs: number | null;
}
