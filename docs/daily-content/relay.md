# Relay — content specification

*Daily Word Relay.* Pass the word baton: link a start word to an end word by
matching each word's first letter to the previous word's last letter.

Code: `packages/games/src/daily/relay/` — `index.ts` (`validatePack`),
`solver.ts` (`findValidChain`).

## How it plays

- The player starts with `startWord` on the chain and a word bank on screen.
- `add_word` appends a bank word whose **first letter equals the last letter of
  the current chain end**. Each bank word may be used once.
- `remove_last` undoes (but never removes the start word).
- `submit` succeeds only when the chain ends on `endWord` → `solved`.
- `give_up` → `failed`.
- Stats report `movesUsed` against `parMoves`.

Everything is chosen from the bank — the player never types a free word. So the
bank *is* the puzzle: the intended chain plus decoys that look plausible.

## Payload schema

```jsonc
{
  "gameId": "relay",
  "puzzleDate": "2026-07-27",
  "sourceRefs": [],                       // optional — word puzzles need no citations
  "payload": {
    "startWord": "STONE",
    "endWord":   "WHALE",
    "wordBank": ["ECHO", "OASIS", "SNOW", "WHALE", "EAGLE", "ORBIT",
                 "SPARK", "WAGON", "TIGER", "NOVEL", "ERASE", "WHEAT"]
  }
}
```

That example validates with `parMoves: 4` — the intended chain is
`STONE → ECHO → OASIS → SNOW → WHALE`, and the other eight bank words are
decoys that chain plausibly but dead-end.

`parMoves` is **derived, not submitted** — the validator sets it to the length
of the chain the solver finds (counting every word after `startWord`, including
`endWord`).

### What `validatePack` does to your submission

In order — this normalization is load-bearing, so submit accordingly:

1. `startWord` and `endWord` are trimmed and **upper-cased**. Both required.
2. `wordBank` must be a non-empty array; non-string and blank entries are
   dropped; the rest are trimmed and upper-cased.
3. **`startWord` is removed from the bank** if present (it is already on the
   chain).
4. **`endWord` is appended to the bank** if missing — so forgetting it is not an
   error, but include it deliberately.
5. `findValidChain(startWord, endWord, wordBank)` must find a path, or the pack
   is rejected with `No valid word chain path found from "X" to "Y" in submitted wordBank`.

The solver is depth-first with a 5000-step budget, no reuse of bank entries, and
returns the **first** path it finds — which is not necessarily the shortest, and
which is what `parMoves` records. Keep the bank small enough that the intended
path is the obvious one.

Note there is **no dictionary check**. Any uppercase string that chains will
pass. Word quality is entirely your responsibility.

## Designing a good puzzle

**Shape.** Target an intended chain of **4–6 words** after the start (so
`parMoves` 4–6) and a bank of **12–18 words** total. Fewer than ~10 makes it
trivial; more than ~20 turns a 3-minute puzzle into a search.

**Build it forwards.** Choose `startWord`, then each next word starting with the
previous word's last letter, until you land on a satisfying `endWord`. Then add
decoys.

**Decoys — the actual craft:**

- Include words that *do* chain from the current position but lead to a dead
  end (nothing in the bank starts with their last letter).
- Include words matching a wrong-but-tempting letter.
- Include at least one word that chains late in the puzzle but is unreachable
  from the start.
- Do **not** include decoys that accidentally create a second valid path to
  `endWord` — the game accepts any valid chain, so a shortcut silently makes the
  puzzle easier than intended. Check the bank for alternate routes before
  submitting; the validator will happily accept a bank with three solutions.

**Letters.** The chaining letter is the last letter of each word, so words
ending in `E`, `S`, `T`, `R`, `N`, `D` give the most continuation options.
Words ending in `X`, `J`, `Q`, `V`, `Z` are dead ends — useful as decoys,
disastrous mid-chain.

**Vocabulary.** Common English words only: no proper nouns, abbreviations,
hyphenated forms, or archaic fill. 3–8 letters reads best on a phone. Nothing
with characters outside A–Z (the normalizer upper-cases but does not strip
punctuation, so `"WELL-FED"` becomes a bank word no one can ever match).

**Variety across days.** No repeating `startWord`/`endWord` pairs; vary chain
length and theme. Optionally theme a bank loosely (weather, kitchen, travel) —
it makes decoys feel intentional.

## Verification

Structural, like Nutshell: `findValidChain` proves solvability, so a Relay pack
needs no citations and can carry `factCheck: { "status": "passed" }` to queue
directly.

Before submitting, verify yourself:

- the intended chain is valid link-by-link (last letter → first letter);
- no word appears twice in the bank;
- `endWord` is reachable and, ideally, reachable only the way you intended;
- every bank word is a real, common English word.
