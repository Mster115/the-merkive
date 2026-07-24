/**
 * Deterministic backtracking solver for merk-chain word puzzles.
 * Finds a path from startWord to endWord using words from wordBank.
 */

export function findValidChain(
  startWord: string,
  endWord: string,
  wordBank: string[],
  maxSteps = 5000
): string[] | null {
  if (!startWord || !endWord || !Array.isArray(wordBank)) {
    return null;
  }

  const start = startWord.trim().toUpperCase();
  const end = endWord.trim().toUpperCase();
  const bank = wordBank.map((w) => w.trim().toUpperCase());

  if (start.length === 0 || end.length === 0) {
    return null;
  }

  // Ensure endWord is in the search pool if not already in bank
  const searchBank = bank.includes(end) ? bank : [...bank, end];

  let steps = 0;

  function backtrack(
    currentWord: string,
    currentPath: string[],
    usedIndices: Set<number>
  ): string[] | null {
    steps += 1;
    if (steps > maxSteps) {
      return null;
    }

    const lastChar = currentWord.charAt(currentWord.length - 1);

    for (let i = 0; i < searchBank.length; i++) {
      if (usedIndices.has(i)) continue;

      const candidate = searchBank[i]!;
      if (candidate.charAt(0) !== lastChar) continue;

      if (candidate === end) {
        return [...currentPath, candidate];
      }

      usedIndices.add(i);
      const res = backtrack(candidate, [...currentPath, candidate], usedIndices);
      usedIndices.delete(i);

      if (res !== null) {
        return res;
      }
    }

    return null;
  }

  return backtrack(start, [], new Set());
}
