import { describe, it, expect } from "vitest";
import {
  cellsOf,
  entryPoint,
  indexInSlot,
  isSlotComplete,
  nextOpenIndex,
  orderedSlots,
  stepSlot,
  type Coord,
} from "../cursor";
import type { NutshellPublicSlot } from "../types";

const slot = (
  number: number,
  row: number,
  col: number,
  length: number
): NutshellPublicSlot => ({ number, row, col, length, clue: `clue ${number}` });

/**
 * The reported case: MARK is already filled going down, and the player starts
 * typing WASP going across. They cross on the A, which is the *second* letter
 * of both words.
 *
 *      col1 col2 col3 col4
 * row0       M
 * row1  W    A    S    P     <- WASP lives on row 1
 * row2       R
 * row3       K
 *
 * So WASP's index 1 is the square MARK already filled, and typing W should
 * put the cursor on index 2 — "I can just type S, P".
 */
const wasp = slot(1, 1, 1, 4);
const mark = slot(2, 0, 2, 4);

function openness(filled: string[]) {
  const set = new Set(filled);
  return (c: Coord) => !set.has(`${c.row}-${c.col}`);
}

describe("cellsOf", () => {
  it("walks an across slot left to right", () => {
    expect(cellsOf(wasp, "across")).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
    ]);
  });

  it("walks a down slot top to bottom", () => {
    expect(cellsOf(mark, "down")).toEqual([
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 3, col: 2 },
    ]);
  });
});

describe("nextOpenIndex — skipping crossing letters", () => {
  it("jumps over the letter a crossing word already supplied", () => {
    // MARK is filled, so row1/col2 (the A) holds a letter.
    const isOpen = openness(["0-2", "1-2", "2-2", "3-2"]);

    // Player types W at index 0; the cursor must land on index 2, skipping
    // the A that MARK supplied at index 1.
    expect(nextOpenIndex(wasp, "across", 0, isOpen)).toBe(2);
  });

  it("skips a run of filled cells, not just one", () => {
    const isOpen = openness(["1-2", "1-3"]);
    expect(nextOpenIndex(wasp, "across", 0, isOpen)).toBe(3);
  });

  it("returns null when the rest of the word is already filled", () => {
    const isOpen = openness(["1-2", "1-3", "1-4"]);
    expect(nextOpenIndex(wasp, "across", 0, isOpen)).toBeNull();
  });

  it("advances one square when nothing is in the way", () => {
    expect(nextOpenIndex(wasp, "across", 0, openness([]))).toBe(1);
  });

  it("never walks past the end of the slot", () => {
    expect(nextOpenIndex(wasp, "across", 3, openness([]))).toBeNull();
  });
});

describe("indexInSlot", () => {
  it("locates a coordinate inside its slot", () => {
    expect(indexInSlot(wasp, "across", { row: 1, col: 3 })).toBe(2);
  });

  it("reports -1 for a coordinate outside the slot", () => {
    expect(indexInSlot(wasp, "across", { row: 0, col: 0 })).toBe(-1);
  });
});

describe("isSlotComplete", () => {
  it("is true only once every square holds a letter", () => {
    const all = ["1-1", "1-2", "1-3", "1-4"];
    expect(isSlotComplete(wasp, "across", openness(all))).toBe(true);
    expect(isSlotComplete(wasp, "across", openness(all.slice(1)))).toBe(false);
  });
});

describe("entryPoint", () => {
  it("lands on the first square that still wants a letter", () => {
    expect(entryPoint(wasp, "across", openness(["1-1", "1-2"]))).toEqual({
      row: 1,
      col: 3,
    });
  });

  it("falls back to the first square when the word is already full", () => {
    const full = openness(["1-1", "1-2", "1-3", "1-4"]);
    expect(entryPoint(wasp, "across", full)).toEqual({ row: 1, col: 1 });
  });
});

describe("orderedSlots and stepSlot — what Enter and Tab walk", () => {
  const across = [slot(3, 2, 0, 3), slot(1, 1, 0, 4)];
  const down = [slot(2, 0, 2, 4), slot(4, 0, 0, 2)];
  const ordered = orderedSlots(across, down);

  it("orders across clues by number, then down clues by number", () => {
    expect(ordered.map((o) => `${o.slot.number}${o.direction[0]}`)).toEqual([
      "1a",
      "3a",
      "2d",
      "4d",
    ]);
  });

  it("moves to the next clue in order", () => {
    const next = stepSlot(ordered, { direction: "across", number: 1 }, 1);
    expect(next).toMatchObject({ direction: "across", slot: { number: 3 } });
  });

  it("crosses from the last across clue into the first down clue", () => {
    const next = stepSlot(ordered, { direction: "across", number: 3 }, 1);
    expect(next).toMatchObject({ direction: "down", slot: { number: 2 } });
  });

  it("wraps from the final clue back to the first", () => {
    const next = stepSlot(ordered, { direction: "down", number: 4 }, 1);
    expect(next).toMatchObject({ direction: "across", slot: { number: 1 } });
  });

  it("steps backwards for shift-tab, wrapping the other way", () => {
    expect(stepSlot(ordered, { direction: "across", number: 1 }, -1)).toMatchObject({
      direction: "down",
      slot: { number: 4 },
    });
    expect(stepSlot(ordered, { direction: "down", number: 2 }, -1)).toMatchObject({
      direction: "across",
      slot: { number: 3 },
    });
  });

  it("starts at the first clue when nothing is selected", () => {
    expect(stepSlot(ordered, null, 1)).toMatchObject({
      direction: "across",
      slot: { number: 1 },
    });
  });

  it("handles an empty puzzle without throwing", () => {
    expect(stepSlot([], { direction: "across", number: 1 }, 1)).toBeNull();
  });
});

describe("the reported MARK/WASP sequence, end to end", () => {
  it("types W, skips the A, and finishes on S and P — three keystrokes", () => {
    // MARK is filled down column 2, so WASP's second square already holds A.
    const filled = new Set(["0-2", "1-2", "2-2", "3-2"]);
    const isOpen = (c: Coord) => !filled.has(`${c.row}-${c.col}`);
    const cells = cellsOf(wasp, "across");
    const type = (i: number) => filled.add(`${cells[i]!.row}-${cells[i]!.col}`);

    let index = 0;
    const visited = [index];

    type(index); // W
    index = nextOpenIndex(wasp, "across", index, isOpen)!;
    visited.push(index);
    expect(index).toBe(2); // straight past the A

    type(index); // S
    index = nextOpenIndex(wasp, "across", index, isOpen)!;
    visited.push(index);
    expect(index).toBe(3);

    type(index); // P

    // The A was never typed over, and the word is finished.
    expect(visited).toEqual([0, 2, 3]);
    expect(nextOpenIndex(wasp, "across", index, isOpen)).toBeNull();
    expect(isSlotComplete(wasp, "across", isOpen)).toBe(true);
  });
});
