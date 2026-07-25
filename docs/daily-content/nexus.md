# Nexus — content specification

*Daily Trivia Crossroads.* A 3×3 grid where each cell asks a question whose
answer satisfies **both** its row category and its column category.

Code: `packages/games/src/daily/nexus/` (`utils.ts` holds `validatePack`).

## How it plays (this drives the content rules)

- The player sees 3 row labels, 3 column labels, and 9 questions.
- **One guess per cell.** A wrong guess locks the cell as `incorrect` — there is
  no second attempt.
- A cell can instead be `revealed`, which shows the answer and scores nothing.
- All 9 cells must be resolved before submitting. Score is correct cells out of
  9; `9/9` is `solved`, anything less is `failed`.

One guess per cell is the whole reason `acceptableAnswers` matters. A player who
knows the answer but types the surname, or the abbreviation, or the British
spelling, must not be marked wrong.

## Answer matching

`normalizeAnswer` (shared by `validatePack` and `reduce`) does exactly this:

1. trim, lowercase
2. collapse internal whitespace runs to one space
3. strip a single leading article: `a `, `an `, or `the `

A guess is correct if its normalized form equals the normalized `answer` **or**
any normalized entry in `acceptableAnswers`.

So you do **not** need variants for case, spacing, or a leading article. You
**do** need them for:

- surname-only vs full name (`answer: "Ada Lovelace"` → `"Lovelace"`)
- abbreviations and expansions (`"NASA"` ↔ `"National Aeronautics and Space Administration"`)
- spelling variants (`"colour"` / `"color"`), transliterations, diacritic-free forms
- common alternative names (`"Mumbai"` / `"Bombay"` where the question allows)
- numerals vs words (`"7"` / `"seven"`)
- punctuation-bearing forms — hyphens and apostrophes are **not** stripped, so
  `"Wall-E"` needs `"WallE"` and `"Wall E"` if you want to accept them

Keep the canonical `answer` in its most natural display form: it is what gets
shown on reveal and in the end-of-game grid.

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
