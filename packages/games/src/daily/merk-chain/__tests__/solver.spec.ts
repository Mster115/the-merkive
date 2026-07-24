import { describe, it, expect } from "vitest";
import { findValidChain } from "../solver";

describe("merk-chain solver", () => {
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
