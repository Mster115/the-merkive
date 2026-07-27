import type { DailyContentPack } from "../types";
import type { NexusPayload, NexusCellSpec } from "./types";

/**
 * Pure answer normalization helper shared between validatePack and reduce.
 *
 * Lowercases, folds accents ("Beyoncé" -> "beyonce"), drops a trailing
 * disambiguating parenthetical ("Mercury (planet)" -> "mercury"), spells "&"
 * as "and", removes punctuation entirely rather than treating it as a word
 * boundary for apostrophes ("O'Brien" -> "obrien", "don't" -> "dont") and as a
 * space for everything else ("Wall-E" -> "wall e", "Dr. Seuss" -> "dr seuss"),
 * collapses whitespace, and strips a leading article ("a", "an", "the").
 *
 * Punctuation is where a player's typing and a content pack's house style
 * differ most often, and none of those differences mean the player was wrong.
 */
export function normalizeAnswer(raw: string): string {
  if (typeof raw !== "string") return "";
  let s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  // Parentheticals are editorial notes on the answer, not part of it.
  s = s.replace(/\([^()]*\)/g, " ");
  s = s.replace(/&/g, " and ");
  s = s.replace(/['’`ʼ]/g, "");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ");
  s = s.trim().replace(/\s+/g, " ");
  if (s.startsWith("a ")) {
    s = s.slice(2).trim();
  } else if (s.startsWith("an ")) {
    s = s.slice(3).trim();
  } else if (s.startsWith("the ")) {
    s = s.slice(4).trim();
  }
  return s;
}

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Parses a spelled-out or digit number ("eight", "twenty-one", "8") into an
 * integer, or null if the string isn't a recognizable number at all. Every
 * token must resolve to a number word — a single unrecognized token (e.g.
 * "paris") bails out to null rather than guessing, so ordinary text answers
 * can never accidentally parse as a number.
 */
export function wordsToNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s === "") return null;

  const digitsOnly = s.replace(/,/g, "");
  if (/^\d+$/.test(digitsOnly)) return parseInt(digitsOnly, 10);

  const tokens = s.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (const tok of tokens) {
    if (tok === "and") continue;
    if (tok in ONES) {
      current += ONES[tok]!;
      matchedAny = true;
    } else if (tok in TENS) {
      current += TENS[tok]!;
      matchedAny = true;
    } else if (tok === "hundred") {
      current = (current === 0 ? 1 : current) * 100;
      matchedAny = true;
    } else if (tok === "thousand") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      matchedAny = true;
    } else {
      return null;
    }
  }

  return matchedAny ? total + current : null;
}

/** Answers this short aren't worth fuzzy-matching — a 1-edit typo on a short
 * word often spells a different, wrong answer ("Rome" -> "Dome"). */
export const MIN_LENGTH_FOR_FUZZY_MATCH = 5;

/**
 * True if `a` and `b` are exactly one edit apart: one insertion, deletion,
 * substitution, or adjacent-character transposition. Used to flag a guess as
 * "close, check your spelling" rather than accepting or rejecting outright.
 */
export function isOneEditAway(a: string, b: string): boolean {
  if (a === b) return false;
  const lenDiff = a.length - b.length;
  if (Math.abs(lenDiff) > 1) return false;

  if (lenDiff === 0) {
    const diffs: number[] = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diffs.push(i);
        if (diffs.length > 2) return false;
      }
    }
    if (diffs.length === 1) return true;
    if (diffs.length === 2) {
      const [i, j] = diffs as [number, number];
      return j === i + 1 && a[i] === b[j] && a[j] === b[i];
    }
    return false;
  }

  const longer = lenDiff === 1 ? a : b;
  const shorter = lenDiff === 1 ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      i++;
    }
  }
  return true;
}

/** A containment match has to hang on something substantial. Four characters
 *  keeps "cup" from standing in for "Stanley Cup" while "Chaplin" still
 *  stands in for "Charlie Chaplin". */
const MIN_LENGTH_FOR_CONTAINMENT = 4;

/** Words that change *which* thing the answer is, so dropping them changes the
 *  answer: "Korea" is not "North Korea". A guess may leave off a first name;
 *  it may not leave off one of these. */
const QUALIFIER_PREFIXES = new Set([
  "north", "south", "east", "west", "northern", "southern", "eastern", "western",
  "new", "old", "great", "greater", "lesser", "little", "big", "upper", "lower",
  "united", "saint", "st", "san", "santa", "los", "las", "el", "la", "le",
  "mount", "mt", "lake", "cape", "port", "fort", "sir", "king", "queen",
  "president", "first", "second", "third", "last", "next",
]);

/** Tokens whose presence means the player listed options rather than answered.
 *  "mercury or venus" should not score just because "mercury" is in there. */
const HEDGE_TOKENS = new Set(["or", "either", "maybe", "vs", "versus"]);

function tokenize(norm: string): string[] {
  return norm === "" ? [] : norm.split(" ");
}

/** True if `needle` appears as a contiguous run of whole tokens in `hay`. */
function containsRun(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

function isNumericAnswer(norm: string): boolean {
  return wordsToNumber(norm) !== null;
}

/**
 * The player said everything the key says and then some — "Charlie Chaplin"
 * for a key of "Chaplin", "Lake Erie" for "Erie". The whole key is present, so
 * the extra words are the player being more specific, not less correct.
 *
 * Capped at two extra words, and refused when the guess hedges ("Mercury or
 * Venus") or when either side is a number, where "four" and "four hundred"
 * are different answers rather than the same one said longer.
 */
function guessRestatesKey(guessTokens: string[], keyTokens: string[]): boolean {
  const extra = guessTokens.length - keyTokens.length;
  if (extra <= 0 || extra > 2) return false;
  if (keyTokens.join("").length < MIN_LENGTH_FOR_CONTAINMENT) return false;
  if (guessTokens.some((tk) => HEDGE_TOKENS.has(tk))) return false;
  if (isNumericAnswer(keyTokens.join(" ")) || isNumericAnswer(guessTokens.join(" "))) {
    return false;
  }
  return containsRun(guessTokens, keyTokens);
}

/**
 * The player gave the tail of a two-word key — "Chaplin" for "Charlie
 * Chaplin", "Einstein" for "Albert Einstein". Surname-only is how people
 * actually answer trivia.
 *
 * Deliberately narrow: two-word keys only, the guess must be the final word,
 * and the dropped word must not be a qualifier that carries the answer's
 * identity, so "Korea" is still wrong for "North Korea" and "Rings" is still
 * wrong for "The Lord of the Rings" (that key is longer than two words).
 */
function guessDropsGivenName(guessTokens: string[], keyTokens: string[]): boolean {
  if (keyTokens.length !== 2 || guessTokens.length !== 1) return false;
  const [first, last] = keyTokens as [string, string];
  const [only] = guessTokens as [string];
  if (only !== last) return false;
  if (only.length < MIN_LENGTH_FOR_CONTAINMENT) return false;
  if (QUALIFIER_PREFIXES.has(first)) return false;
  if (isNumericAnswer(keyTokens.join(" "))) return false;
  return true;
}

/**
 * Whether a normalized guess counts as the normalized key: exactly, as the
 * same number written another way, or as the same answer said with one more
 * or one fewer word (see the two helpers above).
 *
 * Everything here is an *exact* match on meaning. Typo tolerance is separate
 * and deliberately does not score — see `isOneEditAway`.
 */
export function matchesAnswer(normGuess: string, normKey: string): boolean {
  if (normGuess === "" || normKey === "") return false;
  if (normGuess === normKey) return true;

  const guessAsNumber = wordsToNumber(normGuess);
  if (guessAsNumber !== null && wordsToNumber(normKey) === guessAsNumber) return true;

  const guessTokens = tokenize(normGuess);
  const keyTokens = tokenize(normKey);
  return (
    guessRestatesKey(guessTokens, keyTokens) || guessDropsGivenName(guessTokens, keyTokens)
  );
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
  const cleanedCells: NexusCellSpec[] = [];

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

  const cleanPayload: NexusPayload = {
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
      gameId: "nexus",
      puzzleDate,
      payload: cleanPayload,
      sourceRefs: sourceRefs as { url: string; title: string }[],
    },
  };
}
