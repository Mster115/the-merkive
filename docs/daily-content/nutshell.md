# Nutshell — content specification

*The daily puzzle, in a nutshell* — a 5×5 mini crossword.

Code: `packages/games/src/daily/nutshell/` — `index.ts` (`validatePack`),
`grid-solver.ts` (`solveGrid`), `patterns.ts` (`PATTERN_LIBRARY`).

## You submit words, and the server assembles the grid

Nutshell content is **a flat pool of word+clue candidates**. The server does the
rest:

```
candidates → solveGrid() → picks the first PATTERN_LIBRARY shape it can fill
           → assigns words to slots, numbers them, attaches your clues
           → NutshellPayload (gridPattern, across[], down[])
```

A pre-assembled grid is deliberately **not** accepted. The solver is the only
place crossing-letter agreement is actually verified, so every submission goes
through it.

**But you still have to do the crossword construction.** See the next section —
this is the single thing that determines whether a submission is accepted.

## ⚠️ Read this before writing a pool

It is tempting to assume the solver will find an interlocking grid inside any
decent pool of everyday words — the brief used to say as much. **Measured
against the real solver, it will not.** Randomly chosen common English words,
all 3–5 letters and well distributed by length:

| Pool size | Grids found |
| --- | --- |
| 22 – 700 words | 0 of 20 attempts |
| 1,000 words | 0 of 4 |
| 1,300 words | 3 of 4 (~6 s each) |
| 1,836 words (a full common vocabulary) | solves, seconds |
| **10 words chosen to interlock** | **solves instantly** |

That is not a solver defect — the patterns are densely crossed (every one of the
10 slots crosses several others), so a valid fill is a rare structure that a
small arbitrary vocabulary simply does not contain.

**The working content model is therefore: construct the grid yourself, then
submit its words.** You choose the layout, work out ten words whose crossing
letters agree, and submit those ten with their clues. The solver's job is to
*verify* your construction and turn it into a payload — not to discover a grid
you did not design.

Optionally add ~10 spare candidates (verified harmless: a designed 10 plus 12
spares still solves instantly). Spares give the solver alternates if one of your
words has a flaw, but they are not a substitute for designing the interlock.

## Payload schema

```jsonc
{
  "gameId": "nutshell",
  "puzzleDate": "2026-07-27",
  "sourceRefs": [],                       // optional — word puzzles need no citations
  "payload": {
    "candidates": [
      { "word": "MINOR", "clue": "Not the major one" },
      { "word": "MASS",  "clue": "Bulk, or a physics quantity" }
      // … your 10 grid words, plus optional spares
    ]
  }
}
```

`payload.candidates` is the canonical key; `pool` and `words` are accepted
aliases and a bare array also works, but use `candidates`.

Per-candidate rules, enforced by the solver's sanitizer — violations are
**silently dropped**, which is how a pool fails for no visible reason:

- `word`: uppercase A–Z only, **3 to 5 letters** (`/^[A-Z]{3,5}$/`). Input is
  trimmed and upper-cased first. No spaces, digits, hyphens, apostrophes, or
  accents — those candidates vanish before the solver ever sees them.
- `clue`: non-empty string, trimmed.
- Duplicate words (after upper-casing) collapse to the first occurrence.

`nutshell.generatePrompt` now asks for a constructed grid, and derives the
layout it quotes — grid rows, every slot's row/col/length, and the length
histogram — from `PATTERN_LIBRARY` at call time
([`prompt.ts`](../../packages/games/src/daily/nutshell/prompt.ts)). Reorder or
reshape the library and the brief follows; it cannot quote a layout the solver
no longer has. It recommends whichever pattern has the fewest five-letter
slots.

## The layouts

Patterns are tried in order; the first one that fills wins. Each needs 10 words
(5 across + 5 down), no word used twice.

| Pattern | Grid | Slot lengths |
| --- | --- | --- |
| `staircase_tr_bl` | `...## / ..... / ..... / ..... / ##...` | across 3,5,5,5,3 · down 4,4,5,4,4 |
| `staircase_tl_br` | `##... / ..... / ..... / ..... / ...##` | across 3,5,5,5,3 · down 5,4,4,4,4 |
| `tl_br_blocked` | `#.... / … / ....#` | 4×4-letter, 6×5-letter |
| `tr_bl_blocked` | `....# / … / #....` | 4×4-letter, 6×5-letter |
| `four_corners_blocked` | `#...# / … / #...#` | 4×3-letter, 6×5-letter |
| `tl_bl_blocked` | `#.... / … / #....` | 1×3, 2×4, 7×5 |
| `all_open` | no blocks | 10 five-letter words |

The staircases lead deliberately. `all_open` needs a double word square — ten
five-letter words whose rows and columns all agree — which English essentially
cannot supply from everyday vocabulary. **Design for `staircase_tl_br` or
`staircase_tr_bl`**: two 3-letter, four 4-letter, four 5-letter words.

## How to construct a grid

Worked example on `staircase_tl_br` (`##...` top, `...##` bottom):

```
 . . A R C          across  1 (0,2) ARC     down  1 (0,2) ANGRY
 M I N O R                  4 (1,0) MINOR         2 (0,3) ROLE
 A N G L E                  6 (2,0) ANGLE         3 (0,4) CREW
 S C R E W                  7 (3,0) SCREW         4 (1,0) MASS
 S H Y . .                  8 (4,0) SHY           5 (1,1) INCH
```

Procedure:

1. Pick the layout and write out its slot geometry (row, col, length, direction).
2. Fill the three long across rows first — 5-letter words at rows 1, 2, 3 —
   choosing them so their shared columns spell plausible letter sequences.
3. Read the columns off and find real words for them, adjusting the across words
   whenever a column will not resolve. This is the actual work, and it iterates.
4. Fill the short 3-letter across slots last; they are the most forgiving.
5. Verify every crossing by hand before submitting: for each cell, the across
   word's letter must equal the down word's letter.
6. Write clues for all ten words.

Constructor's aids:

- Favour common letters at crossings: `E A R S T L N O I`.
- Vowel-rich short words (`ERA`, `OAT`, `ICE`, `ARIA`, `OBOE`) rescue awkward
  columns.
- `-S`, `-ED`, `-ER` endings give a column a workable final letter.
- Use at most one word containing `J Q X Z V`; two usually makes it unfillable.
- Reuse a known-good skeleton and swap one word at a time rather than starting
  from scratch every day.

## Clue writing

Clues travel with their word, so only the placed words' clues are shown and
spares' clues are discarded. Write all of them properly anyway.

- Original text only. Never lift a clue from a published crossword.
- Definitions, wordplay, and short fill-in-the-blanks all work. Match the
  answer's part of speech and number.
- ~60 characters max — the clue list has to fit a phone.
- No obscure proper nouns, no niche trivia: a mini is solved from language
  knowledge, not lookups.
- Never put the answer word inside its own clue.
- Signal abbreviations (`"Doctor, briefly"`).

## Verification

The solver is the verification: it proves every answer came from your pool and
that all crossings agree, and `validatePack` rejects anything else. No citations
are needed and `sourceRefs` may be empty, so a Nutshell pack can carry
`factCheck: { "status": "passed" }` and queue directly.

If you get `"Failed to assemble valid crossword grid from candidate pool"`, in
order of likelihood: your interlock has a mismatched crossing letter; a
candidate was silently dropped for bad characters or the wrong length; your
length distribution does not match any layout; or a rare letter blocks a
crossing. Re-verify the grid by hand — do not just add more random words, which
the table above shows does not help.
