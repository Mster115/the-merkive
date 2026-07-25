/**
 * Deterministic backtracking solver for relay word puzzles.
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

/**
 * Bank words that are drop-in substitutes for one another.
 *
 * Two words that share a first and last letter link to exactly the same things,
 * so picking between them decides nothing — a playtester found TANGO and TEMPO
 * in one bank and could take either. It does not make the puzzle wrong (Relay
 * scores on moves, and both paths are the same length), which is why this is a
 * warning for the human reviewing a draft rather than a validator rejection:
 * `validatePack` also runs against packs already sitting in the queue, so
 * tightening it there could strand content scheduled to go live.
 *
 * Returns one entry per interchangeable group, largest first, deterministically
 * ordered so the same bank always reports the same way.
 */
export function findInterchangeableWords(wordBank: string[]): string[][] {
  const groups = new Map<string, string[]>();

  for (const raw of wordBank) {
    const word = String(raw ?? "").trim().toUpperCase();
    if (word.length < 2) continue;
    const key = `${word.charAt(0)}:${word.charAt(word.length - 1)}`;
    const bucket = groups.get(key);
    if (bucket) {
      if (!bucket.includes(word)) bucket.push(word);
    } else {
      groups.set(key, [word]);
    }
  }

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort())
    .sort((a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!));
}
