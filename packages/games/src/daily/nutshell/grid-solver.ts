import type { NutshellPayload, NutshellSlot, WordCandidate } from "./types";
import { PATTERN_LIBRARY, type PatternTemplate } from "./patterns";

export interface SolverOptions {
  patterns?: PatternTemplate[];
  maxSteps?: number;
}

export function solveGrid(
  candidates: WordCandidate[],
  options?: SolverOptions
): NutshellPayload | null {
  const patterns = options?.patterns ?? PATTERN_LIBRARY;
  const maxSteps = options?.maxSteps ?? 50_000;

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

  for (const pat of patterns) {
    const acrossSlots = pat.across;
    const downSlots = pat.down;
    const allSlots = [...acrossSlots, ...downSlots];
    const totalSlots = allSlots.length;

    if (sanitizedCandidates.length < totalSlots) {
      continue;
    }

    const grid: (string | null)[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => null)
    );

    // Mark blocked cells
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (pat.gridPattern[r]?.[c] === "#") {
          const rowArr = grid[r];
          if (rowArr) rowArr[c] = "#";
        }
      }
    }

    const usedCandidates = new Set<number>();
    const assignedSlots: (WordCandidate | null)[] = Array.from(
      { length: totalSlots },
      () => null
    );

    let steps = 0;

    function backtrack(slotIdx: number): boolean {
      if (slotIdx === totalSlots) {
        return true;
      }
      steps++;
      if (steps > maxSteps) {
        return false;
      }

      const slot = allSlots[slotIdx];
      if (!slot) return false;

      for (let i = 0; i < sanitizedCandidates.length; i++) {
        if (usedCandidates.has(i)) continue;

        const candidate = sanitizedCandidates[i];
        if (!candidate || candidate.word.length !== slot.length) continue;

        // Check if candidate matches existing letters in grid
        let matches = true;
        for (let k = 0; k < slot.length; k++) {
          const r = slot.dir === "across" ? slot.row : slot.row + k;
          const c = slot.dir === "across" ? slot.col + k : slot.col;
          const existing = grid[r]?.[c];
          if (existing !== undefined && existing !== null && existing !== candidate.word[k]) {
            matches = false;
            break;
          }
        }

        if (!matches) continue;

        // Apply candidate word to grid, recording overwritten cells
        const overwritten: { r: number; c: number; prev: string | null }[] = [];
        for (let k = 0; k < slot.length; k++) {
          const r = slot.dir === "across" ? slot.row : slot.row + k;
          const c = slot.dir === "across" ? slot.col + k : slot.col;
          const rowArr = grid[r];
          const prev = rowArr?.[c] ?? null;
          overwritten.push({ r, c, prev });
          if (rowArr && candidate.word[k]) {
            rowArr[c] = candidate.word[k]!;
          }
        }

        usedCandidates.add(i);
        assignedSlots[slotIdx] = candidate;

        if (backtrack(slotIdx + 1)) {
          return true;
        }

        // Revert grid and candidate state
        for (const cell of overwritten) {
          const rowArr = grid[cell.r];
          if (rowArr) {
            rowArr[cell.c] = cell.prev;
          }
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
