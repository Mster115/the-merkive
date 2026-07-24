import type { DailyContentPack } from "../types";
import type { MerkGridPayload, MerkGridCellSpec } from "./types";

/**
 * Pure answer normalization helper shared between validatePack and reduce.
 * Lowercases, trims, collapses internal whitespace, and strips leading articles ("a", "an", "the").
 */
export function normalizeAnswer(raw: string): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (s.startsWith("a ")) {
    s = s.slice(2).trim();
  } else if (s.startsWith("an ")) {
    s = s.slice(3).trim();
  } else if (s.startsWith("the ")) {
    s = s.slice(4).trim();
  }
  return s;
}

export function generatePrompt(puzzleDate: string): string {
  return (
    `Generate a 3x3 trivia intersection matrix puzzle for date ${puzzleDate}. ` +
    `Provide 3 distinct row category labels and 3 distinct column category labels. ` +
    `Provide exactly 9 verifiable Q&A pairs, one for each (row, col) intersection (row 0-2, col 0-2) ` +
    `where the answer satisfies both row and column categories. Favor recent or current-event ` +
    `freshness where the category allows, using original question phrasing with source citations. ` +
    `Each cell must include row, col, question, canonical answer, and acceptableAnswers list.`
  );
}

export function validatePack(
  raw: unknown,
  puzzleDate: string
): { ok: true; pack: DailyContentPack } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Raw pack must be an object" };
  }

  const obj = raw as Record<string, unknown>;
  const payloadObj =
    typeof obj.payload === "object" && obj.payload !== null
      ? (obj.payload as Record<string, unknown>)
      : obj;

  const sourceRefs = Array.isArray(obj.sourceRefs)
    ? obj.sourceRefs
    : Array.isArray(payloadObj.sourceRefs)
    ? (payloadObj.sourceRefs as unknown[])
    : [];

  if (sourceRefs.length === 0) {
    return { ok: false, error: "Pack sourceRefs must contain at least one citation reference" };
  }

  if (
    !Array.isArray(payloadObj.rowLabels) ||
    payloadObj.rowLabels.length !== 3 ||
    !payloadObj.rowLabels.every((l) => typeof l === "string" && l.trim().length > 0)
  ) {
    return { ok: false, error: "rowLabels must be an array of exactly 3 non-empty strings" };
  }

  if (
    !Array.isArray(payloadObj.colLabels) ||
    payloadObj.colLabels.length !== 3 ||
    !payloadObj.colLabels.every((l) => typeof l === "string" && l.trim().length > 0)
  ) {
    return { ok: false, error: "colLabels must be an array of exactly 3 non-empty strings" };
  }

  if (!Array.isArray(payloadObj.cells) || payloadObj.cells.length !== 9) {
    return { ok: false, error: "cells must contain exactly 9 entries" };
  }

  const seenCoords = new Set<string>();
  const cleanedCells: MerkGridCellSpec[] = [];

  for (const item of payloadObj.cells) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: "Each cell must be an object" };
    }
    const c = item as Record<string, unknown>;
    const row = Number(c.row);
    const col = Number(c.col);

    if (![0, 1, 2].includes(row) || ![0, 1, 2].includes(col)) {
      return { ok: false, error: `Invalid cell coordinates (${c.row}, ${c.col})` };
    }

    const coordKey = `${row}:${col}`;
    if (seenCoords.has(coordKey)) {
      return { ok: false, error: `Duplicate cell coordinate (${row}, ${col})` };
    }
    seenCoords.add(coordKey);

    if (typeof c.question !== "string" || c.question.trim().length === 0) {
      return { ok: false, error: `Cell (${row}, ${col}) has empty question` };
    }

    if (typeof c.answer !== "string" || c.answer.trim().length === 0) {
      return { ok: false, error: `Cell (${row}, ${col}) has empty answer` };
    }

    const acceptable = Array.isArray(c.acceptableAnswers)
      ? c.acceptableAnswers
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .map((a) => a.trim())
      : [];

    cleanedCells.push({
      row,
      col,
      question: c.question.trim(),
      answer: c.answer.trim(),
      acceptableAnswers: acceptable,
    });
  }

  if (seenCoords.size !== 9) {
    return { ok: false, error: "cells must cover all 9 (row, col) intersections" };
  }

  // Sort cells by row then col for deterministic order
  cleanedCells.sort((a, b) => a.row - b.row || a.col - b.col);

  const cleanPayload: MerkGridPayload = {
    rowLabels: [
      String(payloadObj.rowLabels[0]).trim(),
      String(payloadObj.rowLabels[1]).trim(),
      String(payloadObj.rowLabels[2]).trim(),
    ],
    colLabels: [
      String(payloadObj.colLabels[0]).trim(),
      String(payloadObj.colLabels[1]).trim(),
      String(payloadObj.colLabels[2]).trim(),
    ],
    cells: cleanedCells,
  };

  return {
    ok: true,
    pack: {
      gameId: "merk-grid",
      puzzleDate,
      payload: cleanPayload,
      sourceRefs: sourceRefs as { url: string; title: string }[],
    },
  };
}
