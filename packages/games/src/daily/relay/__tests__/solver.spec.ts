import { describe, it, expect } from "vitest";
import { findValidChain, findInterchangeableWords } from "../solver";

describe("relay solver", () => {
  it("finds a valid path in a solvable bank and verifies link agreement", () => {
    const startWord = "CAT";
    const endWord = "DOG";
    const wordBank = ["TIGER", "RABBIT", "TOAD", "DOG", "ELEPHANT"];

    const path = findValidChain(startWord, endWord, wordBank);
    expect(path).not.toBeNull();
    expect(path).toEqual(["TIGER", "RABBIT", "TOAD", "DOG"]);

    // Excludes startWord, includes endWord
    expect(path![0]).toBe("TIGER");
    expect(path![path!.length - 1]).toBe(endWord);

    // Verify every link
    let current = startWord;
    for (const word of path!) {
      const lastChar = current.charAt(current.length - 1);
      const firstChar = word.charAt(0);
      expect(firstChar).toBe(lastChar);
      current = word;
    }
  });

  it("returns null for an unsolvable bank without hanging", () => {
    const startWord = "CAT";
    const endWord = "DOG";
    const wordBank = ["APPLE", "BANANA", "CHERRY"];

    const path = findValidChain(startWord, endWord, wordBank);
    expect(path).toBeNull();
  });

  it("respects the step cap", () => {
    const startWord = "CAT";
    const endWord = "DOG";
    const wordBank = ["TOAD", "DOG", "DRAGON", "NIGHT", "TIGER", "RABBIT"];
    const path = findValidChain(startWord, endWord, wordBank, 1);
    expect(path).toBeNull();
  });

  it("is strictly deterministic", () => {
    const startWord = "CAT";
    const endWord = "DOG";
    const wordBank = ["TIGER", "RABBIT", "TOAD", "DOG", "ELEPHANT", "ZEBRA"];

    const res1 = findValidChain(startWord, endWord, wordBank);
    const res2 = findValidChain(startWord, endWord, wordBank);
    expect(res1).toEqual(res2);
  });
});

describe("findInterchangeableWords", () => {
  it("flags two words that share a first and last letter", () => {
    // The reported pair: both start T and end O, so either links identically
    // and choosing between them decides nothing.
    expect(findInterchangeableWords(["TANGO", "TEMPO", "SUNSET"])).toEqual([
      ["TANGO", "TEMPO"],
    ]);
  });

  it("says nothing about a clean bank", () => {
    expect(findInterchangeableWords(["SUNSET", "TANGO", "OCEAN", "NEBULA"])).toEqual([]);
  });

  it("groups more than two, and reports the biggest group first", () => {
    const groups = findInterchangeableWords(["TANGO", "TEMPO", "TORNADO", "SILVER", "SUMMER"]);
    expect(groups[0]).toEqual(["TANGO", "TEMPO", "TORNADO"]);
    expect(groups[1]).toEqual(["SILVER", "SUMMER"]);
  });

  it("ignores case and surrounding space", () => {
    expect(findInterchangeableWords([" tango ", "TEMPO"])).toEqual([["TANGO", "TEMPO"]]);
  });

  it("does not report a word against itself when the bank repeats one", () => {
    expect(findInterchangeableWords(["TANGO", "TANGO"])).toEqual([]);
  });

  it("shrugs off junk rather than throwing — it runs on unreviewed drafts", () => {
    expect(findInterchangeableWords([])).toEqual([]);
    expect(findInterchangeableWords(["A", "", "OK"] as string[])).toEqual([]);
  });
});
