import type { DailyContentPack } from "../types";
import type { ChipShotPayload } from "./types";

// ─── generatePrompt ─────────────────────────────────────────────────────────

/** Research brief for the content pipeline. */
export function generatePrompt(puzzleDate: string): string {
  return [
    `Generate a Chip Shot daily golf puzzle for ${puzzleDate}.`,
    ``,
    `Provide a JSON payload with these fields:`,
    `  seed            string   — deterministic seed, recommend "${puzzleDate}-chipshot"`,
    `  holeCount       number   — 1-9 (standard: 3)`,
    `  difficulty      1|2|3    — 1 = easy (few obstacles), 2 = medium, 3 = hard (dense)`,
    `  maxStrokesPerHole number — 3-15 (standard: 8)`,
    ``,
    `Example:`,
    `{`,
    `  "seed": "${puzzleDate}-chipshot",`,
    `  "holeCount": 3,`,
    `  "difficulty": 2,`,
    `  "maxStrokesPerHole": 8`,
    `}`,
    ``,
    `Difficulty guidance:`,
    `  Mon/Tue → 1, Wed/Thu → 2, Fri/Sat/Sun → 3`,
    `The seed deterministically generates the entire course layout, so`,
    `different seeds produce different courses with no other input needed.`,
  ].join("\n");
}

// ─── validatePack ───────────────────────────────────────────────────────────

/**
 * Validates + normalises a raw submission envelope into a typed DailyContentPack.
 *
 * Follows the envelope extraction pattern from daily/types.ts:
 *   raw = { gameId, puzzleDate, payload, sourceRefs }
 * but also accepts a bare payload for tests and direct callers.
 */
export function validatePack(
  raw: unknown,
  puzzleDate: string,
): { ok: true; pack: DailyContentPack } | { ok: false; error: string } {
  // Envelope extraction — per daily contract
  const envelope = raw as Record<string, unknown> | null;
  const obj: Record<string, unknown> =
    typeof envelope?.payload === "object" && envelope.payload !== null
      ? (envelope.payload as Record<string, unknown>)
      : (raw as Record<string, unknown>);

  // ── seed ──
  if (typeof obj["seed"] !== "string" || (obj["seed"] as string).length === 0) {
    return { ok: false, error: "seed must be a non-empty string" };
  }
  const seed = obj["seed"] as string;

  // ── holeCount ──
  const holeCount = obj["holeCount"];
  if (
    typeof holeCount !== "number" ||
    !Number.isInteger(holeCount) ||
    holeCount < 1 ||
    holeCount > 9
  ) {
    return { ok: false, error: "holeCount must be an integer between 1 and 9" };
  }

  // ── difficulty ──
  const difficulty = obj["difficulty"];
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3) {
    return { ok: false, error: "difficulty must be 1, 2, or 3" };
  }

  // ── maxStrokesPerHole ──
  const maxStrokes = obj["maxStrokesPerHole"];
  if (
    typeof maxStrokes !== "number" ||
    !Number.isInteger(maxStrokes) ||
    maxStrokes < 3 ||
    maxStrokes > 15
  ) {
    return {
      ok: false,
      error: "maxStrokesPerHole must be an integer between 3 and 15",
    };
  }

  // ── sourceRefs ──
  const sourceRefs: { url: string; title: string }[] = Array.isArray(
    (envelope as Record<string, unknown> | null)?.["sourceRefs"],
  )
    ? ((envelope as Record<string, unknown>)["sourceRefs"] as {
        url: string;
        title: string;
      }[])
    : [];

  return {
    ok: true,
    pack: {
      gameId: "chipshot",
      puzzleDate,
      payload: {
        seed,
        holeCount: holeCount as number,
        difficulty: difficulty as 1 | 2 | 3,
        maxStrokesPerHole: maxStrokes as number,
      },
      sourceRefs,
    },
  };
}
