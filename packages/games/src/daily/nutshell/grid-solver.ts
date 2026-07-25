import type { NutshellPayload, NutshellSlot, WordCandidate } from "./types";
import { PATTERN_LIBRARY, type PatternTemplate } from "./patterns";

export interface SolverOptions {
  patterns?: PatternTemplate[];
  maxSteps?: number;
}

interface SlotRef {
  index: number;
  row: number;
  col: number;
  length: number;
  dir: "across" | "down";
  number: number;
}

function cellsOf(slot: SlotRef): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  for (let k = 0; k < slot.length; k++) {
    cells.push({
      r: slot.dir === "across" ? slot.row : slot.row + k,
      c: slot.dir === "across" ? slot.col + k : slot.col,
    });
  }
  return cells;
}

/**
 * Assembles a filled grid from a pool of candidate words, or returns null.
 *
 * The search is ordered and forward-checked rather than naive. Filling every
 * across slot first means each one lands on an empty grid and matches anything,
 * so the first real constraint arrives only at the down slots — that enumerates
 * ordered tuples of across words and cannot finish on a realistic pool (a
 * 10k-word dictionary ran for ten minutes without converging). Two changes fix
 * it: interleave the slots so each placement crosses one already made, and
 * after every placement check that each unfilled crossing slot still has at
 * least one candidate matching its partial pattern.
 */
export function solveGrid(
  candidates: WordCandidate[],
  options?: SolverOptions
): NutshellPayload | null {
  const patterns = options?.patterns ?? PATTERN_LIBRARY;
  const maxSteps = options?.maxSteps ?? 200_000;

  // Sanitize and deduplicate candidates by uppercase word
  const sanitizedCandidates: WordCandidate[] = [];
  const seenWords = new Set<string>();

  for (const item of candidates) {
    if (!item || typeof item.word !== "string" || typeof item.clue !== "string") {
      continue;
    }
    const cleanWord = item.word.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(cleanWord)) {
      continue;
    }
    if (!seenWords.has(cleanWord)) {
      seenWords.add(cleanWord);
      sanitizedCandidates.push({ word: cleanWord, clue: item.clue.trim() });
    }
  }

  // Index by (length, position, letter) so a partial pattern can be resolved to
  // a small list instead of rescanning the whole pool at every node.
  const byLength = new Map<number, number[]>();
  const byPosLetter = new Map<string, number[]>();
  sanitizedCandidates.forEach((cand, i) => {
    const len = cand.word.length;
    const lenList = byLength.get(len);
    if (lenList) lenList.push(i);
    else byLength.set(len, [i]);

    for (let p = 0; p < len; p++) {
      const key = `${len}:${p}:${cand.word[p]}`;
      const list = byPosLetter.get(key);
      if (list) list.push(i);
      else byPosLetter.set(key, [i]);
    }
  });

  for (const pat of patterns) {
    const acrossSlots = pat.across;
    const downSlots = pat.down;
    const allSlots: SlotRef[] = [
      ...acrossSlots.map((s, i) => ({ ...s, index: i, dir: "across" as const })),
      ...downSlots.map((s, i) => ({
        ...s,
        index: acrossSlots.length + i,
        dir: "down" as const,
      })),
    ];
    const totalSlots = allSlots.length;

    if (sanitizedCandidates.length < totalSlots) {
      continue;
    }

    const grid: (string | null)[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => null)
    );

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (pat.gridPattern[r]?.[c] === "#") {
          const rowArr = grid[r];
          if (rowArr) rowArr[c] = "#";
        }
      }
    }

    const slotCells = allSlots.map(cellsOf);

    /** Candidates still able to fill `slot` given the letters already placed. */
    function optionsFor(slotIdx: number, used: Set<number>): number[] {
      const slot = allSlots[slotIdx]!;
      const cells = slotCells[slotIdx]!;

      // Start from the most selective indexed list available.
      let pool: number[] | undefined;
      for (let k = 0; k < slot.length; k++) {
        const cell = cells[k]!;
        const letter = grid[cell.r]?.[cell.c];
        if (!letter || letter === "#") continue;
        const list = byPosLetter.get(`${slot.length}:${k}:${letter}`) ?? [];
        if (!pool || list.length < pool.length) pool = list;
      }
      pool ??= byLength.get(slot.length) ?? [];

      const out: number[] = [];
      for (const i of pool) {
        if (used.has(i)) continue;
        const word = sanitizedCandidates[i]!.word;
        let ok = true;
        for (let k = 0; k < slot.length; k++) {
          const cell = cells[k]!;
          const letter = grid[cell.r]?.[cell.c];
          if (letter && letter !== "#" && letter !== word[k]) {
            ok = false;
            break;
          }
        }
        if (ok) out.push(i);
      }
      return out;
    }

    // Order so every slot after the first crosses something already placed:
    // that is what makes a bad choice fail immediately instead of five levels
    // down. Ties break toward whichever slot shares the most cells.
    const searchOrder: number[] = [];
    const placedCells = new Set<string>();
    const remaining = new Set(allSlots.map((s) => s.index));
    while (remaining.size > 0) {
      let best = -1;
      let bestOverlap = -1;
      for (const idx of remaining) {
        const overlap = slotCells[idx]!.filter((c) => placedCells.has(`${c.r},${c.c}`)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          best = idx;
        }
      }
      searchOrder.push(best);
      for (const c of slotCells[best]!) placedCells.add(`${c.r},${c.c}`);
      remaining.delete(best);
    }

    const usedCandidates = new Set<number>();
    const assignedSlots: (WordCandidate | null)[] = Array.from(
      { length: totalSlots },
      () => null
    );

    let steps = 0;

    function backtrack(depth: number): boolean {
      if (depth === totalSlots) return true;
      steps++;
      if (steps > maxSteps) return false;

      const slotIdx = searchOrder[depth]!;
      const slot = allSlots[slotIdx]!;
      const cells = slotCells[slotIdx]!;

      for (const i of optionsFor(slotIdx, usedCandidates)) {
        const candidate = sanitizedCandidates[i]!;

        const overwritten: { r: number; c: number; prev: string | null }[] = [];
        for (let k = 0; k < slot.length; k++) {
          const cell = cells[k]!;
          const rowArr = grid[cell.r];
          overwritten.push({ r: cell.r, c: cell.c, prev: rowArr?.[cell.c] ?? null });
          if (rowArr) rowArr[cell.c] = candidate.word[k]!;
        }
        usedCandidates.add(i);
        assignedSlots[slotIdx] = candidate;

        // Forward check: a crossing slot with no surviving option means this
        // placement is already doomed, so reject it here rather than after
        // several more levels of fruitless search.
        let viable = true;
        for (let d = depth + 1; d < totalSlots; d++) {
          if (optionsFor(searchOrder[d]!, usedCandidates).length === 0) {
            viable = false;
            break;
          }
        }

        if (viable && backtrack(depth + 1)) return true;

        for (const cell of overwritten) {
          const rowArr = grid[cell.r];
          if (rowArr) rowArr[cell.c] = cell.prev;
        }
        usedCandidates.delete(i);
        assignedSlots[slotIdx] = null;
      }

      return false;
    }

    if (backtrack(0)) {
      const finalAcross: NutshellSlot[] = acrossSlots.map((s, idx) => {
        const candidate = assignedSlots[idx]!;
        return {
          number: s.number,
          row: s.row,
          col: s.col,
          length: s.length,
          clue: candidate.clue,
          answer: candidate.word,
        };
      });

      const finalDown: NutshellSlot[] = downSlots.map((s, idx) => {
        const candidate = assignedSlots[acrossSlots.length + idx]!;
        return {
          number: s.number,
          row: s.row,
          col: s.col,
          length: s.length,
          clue: candidate.clue,
          answer: candidate.word,
        };
      });

      return {
        gridPattern: pat.gridPattern,
        across: finalAcross,
        down: finalDown,
      };
    }
  }

  return null;
}
