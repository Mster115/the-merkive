import { createHash } from "node:crypto";
import type { DailyPuzzleRow } from "@merky/db";

/**
 * Content identity for daily puzzles.
 *
 * The platform stores puzzles by date and has no notion of "have I shipped this
 * before" — nothing stops the same grid or the same nine questions being queued
 * again months later, and a returning player would notice immediately. These
 * helpers give every puzzle a stable identity plus the item-level tokens that
 * make a near-repeat visible, so `submitPack` can refuse a duplicate outright.
 *
 * Fingerprints are derived from the answer key, so they are one-way on purpose:
 * a digest can be handed to a content generator without handing it the answers.
 */

function sha(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export interface PuzzleDigest {
  puzzleDate: string;
  status: string;
  /** Stable identity of the whole puzzle. Equal fingerprints = the same puzzle. */
  fingerprint: string;
  /**
   * Per-item identities (an answer, a grid word, a start/end pair). Hashed, so a
   * caller can test "did I already use this?" without learning what it was.
   */
  itemTokens: string[];
  /**
   * The same items in the clear. Populated only for puzzles whose date has
   * already passed — those answers are public to anyone who played that day, so
   * showing them costs nothing and lets a generator honour no-repeat windows.
   */
  recentItems?: string[];
}

/** The content items that define a puzzle, in canonical form. */
export function puzzleItems(gameId: string, payload: unknown): string[] {
  const p = (payload ?? {}) as Record<string, unknown>;

  if (gameId === "nexus") {
    const cells = Array.isArray(p.cells) ? p.cells : [];
    return cells
      .map((c) => norm((c as { answer?: unknown }).answer))
      .filter(Boolean)
      .sort();
  }

  if (gameId === "nutshell") {
    const slots = [
      ...(Array.isArray(p.across) ? p.across : []),
      ...(Array.isArray(p.down) ? p.down : []),
    ];
    return slots
      .map((s) => norm((s as { answer?: unknown }).answer))
      .filter(Boolean)
      .sort();
  }

  if (gameId === "relay") {
    // The start/end pair is the puzzle; the bank is dressing. A repeated pair
    // is a repeated puzzle even if the decoys differ.
    const pair = `${norm(p.startWord)}->${norm(p.endWord)}`;
    return pair === "->" ? [] : [pair];
  }

  if (gameId === "waypoint") {
    // Target first, then the bank sorted. The same target over a reshuffled
    // bank is the same puzzle; the same bank pointed at a different target is
    // not, which is why the target is not merged into the sort.
    const locs = p.locations ?? p.availableLocations ?? [];
    const names = Array.isArray(locs)
      ? locs
          .map((l) => norm((l as { name?: unknown }).name))
          .filter(Boolean)
          .sort()
      : [];
    const targetName = norm((p.target as { name?: unknown } | undefined)?.name);
    return targetName ? [targetName, ...names] : names;
  }

  if (gameId === "detour") {
    // City name, then route POI IDs, then sorted candidate POI IDs
    const cityName = norm(p.cityName);
    const route = Array.isArray(p.route) ? p.route : [];
    const routeIds = route
      .map((r) => norm((r as { poiId?: unknown; poiName?: unknown }).poiId ?? (r as { poiName?: unknown }).poiName))
      .filter(Boolean);
    const candidatePois = Array.isArray(p.candidatePois) ? p.candidatePois : [];
    const candIds = candidatePois
      .map((c) => norm((c as { id?: unknown; name?: unknown }).id ?? (c as { name?: unknown }).name))
      .filter(Boolean)
      .sort();
    return [cityName, ...routeIds, ...candIds].filter(Boolean);
  }

  return [];
}

export function fingerprintPuzzle(gameId: string, payload: unknown): string {
  const items = puzzleItems(gameId, payload);
  if (items.length === 0) {
    // Unknown shape: fall back to the payload itself so an unrecognised game
    // still gets a stable identity rather than colliding with every other one.
    return sha(`${gameId}|raw|${JSON.stringify(payload ?? null)}`);
  }
  return sha(`${gameId}|${items.join("|")}`);
}

export function itemToken(gameId: string, item: string): string {
  return sha(`${gameId}|item|${item}`);
}

export function digestPuzzle(row: DailyPuzzleRow, today: string): PuzzleDigest {
  const items = puzzleItems(row.game_id, row.payload);
  return {
    puzzleDate: row.puzzle_date,
    status: row.status,
    fingerprint: fingerprintPuzzle(row.game_id, row.payload),
    itemTokens: items.map((i) => itemToken(row.game_id, i)),
    ...(row.puzzle_date < today ? { recentItems: items } : {}),
  };
}

export interface RepeatCheck {
  ok: boolean;
  /** Present when the exact puzzle has shipped before. */
  duplicateOf?: string;
  /** Items this puzzle shares with an existing one, and where. */
  overlaps: { item: string; puzzleDate: string }[];
}

/**
 * Whether a candidate payload may be queued.
 *
 * An identical fingerprint is refused outright — that is the "never ship the
 * same puzzle twice" guarantee. Item overlap is reported but not fatal on its
 * own: one repeated answer across months is fine, and the caller decides what
 * recency window to enforce.
 */
export function checkRepeat(
  gameId: string,
  payload: unknown,
  history: { puzzleDate: string; fingerprint: string; itemTokens: string[] }[]
): RepeatCheck {
  const fingerprint = fingerprintPuzzle(gameId, payload);
  const items = puzzleItems(gameId, payload);
  const tokens = new Map(items.map((i) => [itemToken(gameId, i), i]));

  const duplicate = history.find((h) => h.fingerprint === fingerprint);
  const overlaps: { item: string; puzzleDate: string }[] = [];

  for (const past of history) {
    for (const token of past.itemTokens) {
      const item = tokens.get(token);
      if (item) overlaps.push({ item, puzzleDate: past.puzzleDate });
    }
  }

  return {
    ok: !duplicate,
    ...(duplicate ? { duplicateOf: duplicate.puzzleDate } : {}),
    overlaps,
  };
}
