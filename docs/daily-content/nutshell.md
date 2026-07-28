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
against the real solver, it will not.** All 3–5 letters, well distributed by
length:

| Pool | Grids found |
| --- | --- |
| ~1,200 curated **everyday** words | **0**, on all seven patterns — the search exhausts, and raising the budget to 20M steps or shuffling the pool 12 times changes nothing |
| 2,000 words from `/usr/share/dict/words` | 3 of 3, ~600 ms |
| 5,000+ dictionary words | instant (~20 ms) |
| 400 solved grids, filtered to all-everyday fill | **0** |
| **10 words chosen to interlock** | **solves instantly** |

Read those rows together and the shape of the problem is clear. The solver is
sound and fast; it exhausts rather than gives up. What it needs is *vocabulary
depth*, and the depth that makes fills appear is exactly the depth that makes
them archaic: the dictionary runs produce `URARE`, `NEUME`, `PALUS`, `IWIS`,
`LEUCH`, `AAL`, `ARARA` — technically valid, unshippable as a daily mini. Of 400
solved grids sampled from the full 14,008-word list, not one had all ten words
in everyday vocabulary.

This is the classic crossword-construction squeeze, and the patterns make it
acute: with only 0–2 blocked squares, every one of the ten slots crosses several
others, so a fill is close to a double word square.

> **Earlier versions of this document reported that ~1,300 random common words
> solved 3 times in 4.** That was an artifact: those random subsets happened to
> contain all ten words of the repo fixture's hand-built grid, and the fixture
> grid was what the solver kept finding. Remove those ten and the same
> vocabulary yields nothing.

**Since then the library gained the `corners_3x3` patterns, which everyday
vocabulary *can* fill** (see the table's first row — that measurement was taken
against the older, denser layouts). The practical route is now
[`daily_grid`](mcp-server.md): it fills a grid from the curated word list, checks
it has never been used, and hands you ten words to clue. Constructing by hand is
still supported and still verified, but it is no longer the only option.

## Seeds and themes — putting the week in the answers

The fill vocabulary is deliberately evergreen, so `daily_grid` accepts two
optional inputs that let a grid belong to its week without giving up verified
construction:

- **`seedWords`** — ranked candidates for **one** required topical answer (a
  name, a title, a term: MOANA, TESLA, OASIS), each 3–5 letters A–Z. The tool
  builds the grid around the first candidate the everyday fill can surround and
  reports the rest in `seedsRejected`, with reasons. Letter shape decides more
  than fame — vowel-rich candidates place in milliseconds, consonant clumps and
  rare letters may never place — so always pass alternatives. Measured on the
  shipped word list: anchoring a slot prunes the search enough that seeded
  staircase grids (score ~40) land in 1–10 s inside a tool call, with the
  corner layouts as a guaranteed floor. Two seeds in one 5×5 is effectively
  out of reach (measured: every tested pair fails — on the corner layouts the
  only two 5-slots cross each other), which is why the contract is one seed
  per grid.
- **`themeWords`** — 10–20 everyday words around one loose theme. Themes are
  delivered by anchoring, not hoping: a sampled fill almost never contains a
  given theme vocabulary by chance, so one theme word is guaranteed a slot
  whenever any of them can hold one, the ranking rewards whatever else the
  fill picks up, and `themeWordsPlaced` reports what landed.

Fairness falls out of the design: with a single seed, every crossing of the
proper noun is an everyday word, so each of its letters is checkable from a
crossing — the standard that keeps a name fair in a mini. The committed bank
cannot serve seeded grids (it was built before the week happened), so seeded
days always use the live search; themed days prefer a bank grid that already
carries the theme, then fall back to anchoring live.

**A seeded grid re-enters fact-checking.** A proper-noun answer asserts a
real-world fact — that the thing exists and is spelled that way — so a seeded
pack must carry a `sourceRef` for the page that verified the seed and ship as
`factCheck.status: "needs_review"`. The word-game exemption in the
[editorial standards](editorial-standards.md) applies only to all-everyday
grids whose clues assert nothing.

**If you are constructing by hand: construct the grid, then submit its words.** You choose the layout, work out ten words whose crossing
letters agree, and submit those ten with their clues. The solver's job is to
*verify* your construction and turn it into a payload — not to discover a grid
you did not design.

Both fixes that were proposed here have shipped:

1. **A curated word list** — [`wordlist.ts`](../../packages/games/src/daily/nutshell/wordlist.ts),
   ~2,600 everyday 3–5 letter words. Not used by the game at runtime; it exists
   so tooling can propose a fill without a constructor. At this size the richer
   staircase layouts fill too, which they could not at 1,200 — grid quality is a
   function of vocabulary depth.
2. **Sparser patterns** — `corners_3x3` and its mirror, which leave eight
   3-letter slots and two 5-letter ones. Any new pattern must avoid runs shorter
   than 3 (the solver only accepts 3–5 letter words) and must leave no open cell
   outside a slot; a test enforces both.

Together they make Nutshell the *easiest* game to supply rather than the
hardest: `daily_grid` returns ten interlocking words and you write ten clues.
Grids are searched offline by
[`build-nutshell-grids.mjs`](../../scripts/build-nutshell-grids.mjs) and served
from a committed bank, because the layouts worth using take seconds to minutes
to fill. When the bank runs low, rebuild it; if that stops producing new grids,
add words to the list.

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

Every pattern needs 10 words (5 across + 5 down), no word used twice. This table
is generated from `PATTERN_LIBRARY`; if it disagrees with the code, the code is
right.

| Pattern | Grid | Slot lengths |
| --- | --- | --- |
| `corners_3x3` | `...## / ...## / ..... / ##... / ##...` | across 3,3,5,3,3 · down 3,3,5,3,3 — 8×3, 2×5 |
| `corners_3x3_mirror` | `##... / ##... / ..... / ...## / ...##` | across 3,3,5,3,3 · down 5,3,3,3,3 — 8×3, 2×5 |
| `staircase_tr_bl` | `...## / ..... / ..... / ..... / ##...` | across 3,5,5,5,3 · down 4,4,5,4,4 — 2×3, 4×4, 4×5 |
| `staircase_tl_br` | `##... / ..... / ..... / ..... / ...##` | across 3,5,5,5,3 · down 5,4,4,4,4 — 2×3, 4×4, 4×5 |
| `tl_br_blocked` | `#.... / ..... / ..... / ..... / ....#` | across 4,5,5,5,4 · down 5,5,5,4,4 — 4×4, 6×5 |
| `tr_bl_blocked` | `....# / ..... / ..... / ..... / #....` | across 4,5,5,5,4 · down 4,5,5,5,4 — 4×4, 6×5 |
| `four_corners_blocked` | `#...# / ..... / ..... / ..... / #...#` | across 3,5,5,5,3 · down 5,5,5,3,3 — 4×3, 6×5 |
| `tl_bl_blocked` | `#.... / ..... / ..... / ..... / #....` | across 4,5,5,5,4 · down 5,5,5,5,3 — 1×3, 2×4, 7×5 |
| `all_open` | `..... / ..... / ..... / ..... / .....` | across 5,5,5,5,5 · down 5,5,5,5,5 — 10×5 |

Order matters: `solveGrid` takes the **first** pattern it can fill. The corner
layouts lead because they are the only ones a modest word pool can fill at all,
so a pool submission always has somewhere to land. The staircases follow — they
make much better puzzles (two 3s, four 4s, four 5s rather than eight 3s) and a
richer vocabulary does fill them, which is what the grid bank is built from.
`all_open` needs a double word square and stays last.

**Constructing by hand? Design for a staircase**: two 3-letter, four 4-letter,
four 5-letter words. A hand-built staircase still solves instantly when its ten
words are submitted.

## How to construct a grid

> **If you have the `daily_grid` MCP tool, you do not do any of this.** That tool
> performs this construction and returns ten interlocking, never-used words,
> optionally built around a topical seed or theme. This section — and the
> matching half of the `daily_brief` output — is the manual fallback for a caller
> without it. See [mcp-server.md](mcp-server.md).

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
  knowledge, not lookups. (A seed answer is the deliberate exception: it may
  be a proper noun precisely because it is a household name of the moment,
  its clue carries the context, and its crossings are all everyday words.)
- Never put the answer word inside its own clue.
- Signal abbreviations (`"Doctor, briefly"`).

## Verification

The solver is the verification: it proves every answer came from your pool and
that all crossings agree, and `validatePack` rejects anything else. For an
all-everyday grid clued by definition and wordplay, no citations are needed,
`sourceRefs` may be empty, and the pack can carry
`factCheck: { "status": "passed" }` and queue directly. A pack whose grid
contains a seed word, or whose clues assert real-world facts, instead ships as
`"needs_review"` with a `sourceRef` per fact — see
[Seeds and themes](#seeds-and-themes--putting-the-week-in-the-answers).

If you get `"Failed to assemble valid crossword grid from candidate pool"`, in
order of likelihood: your interlock has a mismatched crossing letter; a
candidate was silently dropped for bad characters or the wrong length; your
length distribution does not match any layout; or a rare letter blocks a
crossing. Re-verify the grid by hand — do not just add more random words, which
the table above shows does not help.
