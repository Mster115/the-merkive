# Nexus — content specification

*Daily Trivia Crossroads.* A 3×3 grid where each cell asks a question whose
answer satisfies **both** its row category and its column category.

Code: `packages/games/src/daily/nexus/` (`utils.ts` holds `validatePack`).

## How it plays (this drives the content rules)

- The player sees 3 row labels, 3 column labels, and 9 questions.
- **Unlimited guesses, decaying value.** A wrong guess leaves the cell open and
  worth less: 1 point first try, then ½, then ¼, then nothing. A player can also
  give up on a cell, which closes it as `incorrect` without showing the answer.
- A cell can instead be `revealed`, which shows the answer and scores nothing.
- All 9 cells must be resolved before submitting. Score is fractional out of 9;
  a full 9 correct is `solved`, anything less is `failed`.

Retries soften a thin `acceptableAnswers` list but do not fix it: a player who
knows the answer and types it a different way loses points for being right.

## Answer matching

`normalizeAnswer` (shared by `validatePack` and `reduce`) does exactly this:

1. fold accents (`Beyoncé` → `beyonce`) and lowercase
2. drop parentheticals (`Mercury (planet)` → `mercury`)
3. expand `&` to `and`
4. delete apostrophes (`O'Brien` → `obrien`) and turn all other punctuation into
   a space (`Wall-E` → `wall e`, `Dr. Seuss` → `dr seuss`)
5. collapse whitespace runs to one space, trim
6. strip a single leading article: `a `, `an `, or `the `

A guess then counts as correct when, against the `answer` or any entry in
`acceptableAnswers`, it is:

- **the same string**, normalized; or
- **the same number** written either way (`8` / `eight` / `twenty-one`); or
- **the same answer with up to two extra words**, the key appearing intact
  (`"Charlie Chaplin"` for a key of `"Chaplin"`, `"Lake Erie"` for `"Erie"`) —
  refused if the guess hedges (`"Mercury or Venus"`) or either side is a number;
  or
- **a two-word key with its first word dropped**, where the guess is the second
  word (`"Chaplin"` for `"Charlie Chaplin"`) — refused when the dropped word is
  what identifies the answer (`"Korea"` is not `"North Korea"`, `"Zealand"` is
  not `"New Zealand"`).

A guess one typo away from a key (5+ characters) is neither accepted nor
counted: the player is told to check their spelling and the attempt is not
spent.

So you no longer need variants for case, spacing, articles, punctuation,
accents, numerals-vs-words, or first-name-vs-surname. You **do** still need them
for:

- abbreviations and expansions (`"NASA"` ↔ `"National Aeronautics and Space Administration"`)
- spelling variants (`"colour"` / `"color"`) and transliterations
- common alternative names (`"Mumbai"` / `"Bombay"` where the question allows)
- anything a reasonable player would say that shares no words with the key
  (`"the Bard"` for `"William Shakespeare"`)

Keep the canonical `answer` in its most natural display form: it is what gets
shown on reveal and in the end-of-game grid.

### Ambiguity is a question problem, not a matching problem

Matching will never accept a *broader* answer than the key, and it should not:
`"The Lord of the Rings"` cannot be allowed to score for `"The Return of the
King"`, because it would equally score for the other two films. When the answer
is one installment of a series — a film, a book, an album, a numbered event —
the **question** has to pin it down (`"Which 2003 film…"`, `"the third film
in…"`, `"which 1994 album…"`). A question that a knowledgeable player can answer
with the franchise name is a broken question, and it is the most common source
of "I was right and it said no".

## Payload schema

`validatePack` enforces every rule below and rejects with a specific message.

```jsonc
{
  "gameId": "nexus",
  "puzzleDate": "2026-07-27",
  "sourceRefs": [                        // REQUIRED: ≥1, or the pack is rejected
    { "url": "https://…", "title": "…" }
  ],
  "payload": {
    "rowLabels": ["…", "…", "…"],        // exactly 3, non-empty strings
    "colLabels": ["…", "…", "…"],        // exactly 3, non-empty strings
    "cells": [                            // exactly 9, one per (row, col)
      {
        "row": 0,                         // 0 | 1 | 2
        "col": 0,                         // 0 | 1 | 2
        "question": "…",                  // non-empty
        "answer": "…",                    // non-empty, canonical display form
        "acceptableAnswers": ["…"]        // optional; non-string entries dropped
      }
      // … 8 more
    ]
  }
}
```

Validator specifics worth knowing:

- **`sourceRefs` is required for Nexus and only for Nexus.** Zero citations →
  `"Pack sourceRefs must contain at least one citation reference"`. It is read
  off the envelope, falling back to `payload.sourceRefs`.
- `cells` must have exactly 9 entries covering all 9 coordinates; a duplicate
  coordinate is rejected by name.
- Strings are trimmed. Cells are sorted by row then col, so submission order
  doesn't matter.
- `acceptableAnswers` defaults to `[]` if absent or not an array.
- The validator does **not** check that the answer actually fits the two
  category labels, that the answer is unique, or that anything is true. That is
  entirely editorial — it is the reason this game carries the fact-check burden.

## Category design

Rows and columns are independent axes; every cell is their intersection.

Good axis pairs give 9 natural intersections:

- rows = decades (`1970s`, `1980s`, `1990s`), cols = domains (`Film`, `Music`, `Science`)
- rows = continents, cols = categories (`Capital cities`, `Rivers`, `Currencies`)
- rows = `Starts with S` / `Two words` / `Contains a number`, cols = subject areas

Rules:

- All 3 row labels distinct; all 3 column labels distinct; no row label
  duplicating a column label.
- Labels short enough to read on a phone — roughly ≤22 characters.
- A label must be a *closed, checkable* property. `"Hard ones"` is not a
  category; `"Nobel laureates"` is.
- Every answer must genuinely satisfy both of its labels — that is the entire
  premise of the game, and a player who spots a violation loses trust in the
  whole grid.
- Avoid an axis so narrow that all three of its cells have the same answer set.

## Question writing

- One sentence, ≤140 characters, ending in a question mark.
- Self-contained: never "as of today" or "this week" — puzzles are also played
  from the archive long after their date.
- No compound questions; one answer, one cell.
- Don't restate the categories in the question ("Which 1980s film…" when the row
  is already `1980s`) — it wastes the grid's premise. Let the axes do that work.
- **No question may contain another cell's answer.** All nine questions are in
  `publicState` from the first render, so one wording gives a different cell
  away for free. This is easy to do without noticing — a real draft asked for
  the element "named after the **Titans**" while another cell's answer was
  TITAN, and described a caldera as what forms when a "**magma** reservoir"
  collapses while another answer was MAGMA. `pnpm daily verify` rejects this.
- Aim for a single-token or short-phrase answer; anything needing a sentence is
  wrong for a one-shot text input.

## Fact-checking

Apply the [rubric](editorial-standards.md#fact-check-rubric) to all 9 cells.
Then:

```jsonc
"factCheck": {
  "status": "passed" | "needs_review",
  "checkedAt": "2026-07-25T12:00:00Z",
  "cells": [
    { "row": 0, "col": 0, "verdict": "verified", "sources": ["https://…", "https://…"] }
  ],
  "notes": "cell (1,2) has two plausible answers — flagged"
}
```

`status: "passed"` queues the pack live with no human review. Everything else
holds it as a draft. Use it honestly; see the open decision in
[README.md](README.md#open-decision-yours-not-the-routines).
