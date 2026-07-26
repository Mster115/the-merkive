import type { NutshellPublicSlot } from "./types";

export type Direction = "across" | "down";

export interface Coord {
  row: number;
  col: number;
}

export interface OrderedSlot {
  direction: Direction;
  slot: NutshellPublicSlot;
}

/** The cells a slot covers, in reading order. */
export function cellsOf(slot: NutshellPublicSlot, direction: Direction): Coord[] {
  return Array.from({ length: slot.length }, (_, i) =>
    direction === "across"
      ? { row: slot.row, col: slot.col + i }
      : { row: slot.row + i, col: slot.col }
  );
}

/** Which cell of the slot a coordinate is, or -1 if it is outside. */
export function indexInSlot(
  slot: NutshellPublicSlot,
  direction: Direction,
  at: Coord
): number {
  const cells = cellsOf(slot, direction);
  return cells.findIndex((c) => c.row === at.row && c.col === at.col);
}

/**
 * The next cell in the slot that still wants a letter, searching forward from
 * `from` (exclusive).
 *
 * This is the "skip what the crossing already gave me" rule. Typing WASP into
 * an across slot whose third square already holds the A from a completed MARK
 * should land on the fourth square after the W, not overwrite the A — and it
 * must skip a *run* of filled squares, not just one, or a word with two
 * crossings still fights the player.
 *
 * Returns null when the rest of the slot is already filled.
 */
export function nextOpenIndex(
  slot: NutshellPublicSlot,
  direction: Direction,
  from: number,
  isOpen: (c: Coord) => boolean
): number | null {
  const cells = cellsOf(slot, direction);
  for (let i = from + 1; i < cells.length; i++) {
    if (isOpen(cells[i]!)) return i;
  }
  return null;
}

/** True when every cell in the slot holds a letter. */
export function isSlotComplete(
  slot: NutshellPublicSlot,
  direction: Direction,
  isOpen: (c: Coord) => boolean
): boolean {
  return cellsOf(slot, direction).every((c) => !isOpen(c));
}

/**
 * Every slot in clue order: all the across clues by number, then all the down
 * clues. This is the order Enter and Tab walk.
 */
export function orderedSlots(
  across: NutshellPublicSlot[],
  down: NutshellPublicSlot[]
): OrderedSlot[] {
  const byNumber = (a: NutshellPublicSlot, b: NutshellPublicSlot) => a.number - b.number;
  return [
    ...[...across].sort(byNumber).map((slot) => ({ direction: "across" as const, slot })),
    ...[...down].sort(byNumber).map((slot) => ({ direction: "down" as const, slot })),
  ];
}

/**
 * The clue `step` places away from the current one, wrapping around the end.
 *
 * Wrapping past the last across clue lands on the first down clue, which is
 * what a crossword solver expects from Tab: one continuous loop through the
 * puzzle rather than two separate lists.
 */
export function stepSlot(
  ordered: OrderedSlot[],
  current: { direction: Direction; number: number } | null,
  step: number
): OrderedSlot | null {
  if (ordered.length === 0) return null;
  if (!current) return ordered[0]!;

  const i = ordered.findIndex(
    (o) => o.direction === current.direction && o.slot.number === current.number
  );
  if (i === -1) return ordered[0]!;

  const next = (i + step + ordered.length * Math.abs(step || 1)) % ordered.length;
  return ordered[next]!;
}

/**
 * Where the cursor lands when a clue is selected: its first cell that still
 * wants a letter, or its first cell if the whole word is already filled.
 */
export function entryPoint(
  slot: NutshellPublicSlot,
  direction: Direction,
  isOpen: (c: Coord) => boolean
): Coord {
  const cells = cellsOf(slot, direction);
  return cells.find((c) => isOpen(c)) ?? cells[0]!;
}
