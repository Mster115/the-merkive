---
name: daily-merkive-nutshell
description: Fills The Merkive's daily Nutshell puzzle — a 5x5 mini crossword whose interlocking grid is built by the daily_grid solver, not by hand. Picks a seeded, themed or plain mode for the day, writes one original clue per word, and queues it through the merkive-daily MCP tools. Use when running the scheduled Nutshell content fill, when the Nutshell queue needs topping up, or when asked to draft or queue Nutshell puzzles.
---

# Daily fill — Nutshell

You keep The Merkive's Nutshell mini crossword supplied with content, running
unattended on a schedule through the `merkive-daily` MCP tools. Handle
**nutshell only** — Nexus and Relay have their own scheduled tasks. Do not
submit for them.

**Read these first:**

- [Editorial rules](../_daily-shared/editorial.md) — the prime directive, originality, safety
- [Research and sourcing](../_daily-shared/sources.md) — reading the room, the source map, browser policy
- [Run procedure](../_daily-shared/run-procedure.md) — `daily_plan` → `daily_check` → `daily_submit`, and the draft gate
- [Workflow graph](../_daily-shared/workflow-graph.md) — the authoritative control flow: every failure edge, retry budget and terminal state
- [Clue craft](../_daily-shared/clue-craft.md) — substitutability, signalling, crosswordese, the Natick rule

Deeper background, only if something here is ambiguous:
[docs/daily-content/nutshell.md](../../../docs/daily-content/nutshell.md) for the
full spec, and `daily_brief` for the live payload schema. Trust `daily_brief` over
any document — the code is the contract.

## The solver builds the grid, not you

Call **`daily_grid`**. It returns ten interlocking words that have never been
used. **Do NOT attempt to construct a grid yourself** — the geometry is derived
from the solver's own pattern library, and a hand-built grid will not validate.

Your job is choosing the day's mode, supplying good candidates, and writing the
clues.

## Pick one mode per day, varied across the week

**SEEDED** — when your research surfaced something that fits.

Pass `seedWords`: 3–6 verified candidates, **best first**, each 3–5 letters A–Z.
Prefer vowel-rich candidates and always give alternatives — **letter shape
decides what fits, not fame.**

Every candidate must clear the same bar as a Nexus answer *before* you pass it:
confirmed (spelling included) against a Tier-1 page you actually retrieved, older
than 72 hours, still true later, public figures in public roles only. Screen them
against `daily_history` in **one batched call** first.

The response reports what was placed (`seedUsed`) and why the rest were not
(`seedsRejected`). **A rejection is the solver protecting the grid, not a problem
to fix** — do not re-send a rejected seed, and do not reroll hoping it lands.

**THEMED** — pass `themeWords`: 10–20 everyday 3–5 letter words around one loose
theme (kitchen, ocean, autumn). The grid carries what it can
(`themeWordsPlaced`); echo the theme in those words' clues and let the rest be
plain.

**PLAIN** — neither. Clean definitions and wordplay carry the day.

Some days a loose general theme is nicer than news; some days plain wordplay is
best. **Never force it:** a strained topical answer is worse than a clean plain
one.

### Rerolling

If a grid's words are dull, call `daily_grid` again with `avoidWords`. **Cap this
at two rerolls.** Beyond that you are spending the run on marginal word quality.

If `daily_check` rejects a grid `daily_grid` itself just produced, for a
structural reason no choice of words could affect, stop — that is the pipeline
disagreeing with itself. See
[run-procedure.md](../_daily-shared/run-procedure.md#when-the-pipeline-disagrees-with-itself).

## Clue writing

**[clue-craft.md](../_daily-shared/clue-craft.md) is the reference** —
substitutability, agreement, signalling, the `?` convention, crosswordese, the
Natick rule, and the specific ways generated clues go wrong. Read it before
writing the ten clues.

The non-negotiables, one original clue per word:

- Never lifted from a published crossword
- ~60 characters
- Part of speech matching the answer, and substitutable for it in a sentence
- **Never containing the answer word or its stem**
- Signal abbreviations, foreign words, plurals and slang — "Doctor, briefly"
- `?` only on wordplay, never on a straight definition
- **Never assert an anagram, reversal or letter count** — these are unreliable to
  compute and instantly visible when wrong
- Clue-level relevance beats a flat definition everywhere: "Streaming hit about
  ___" beats "A large body of water"
- Clue a placed seed through the thing that made it current, **never through
  anyone's private life**

## The fact-check bar

Nutshell's exposure depends entirely on whether the puzzle asserts anything about
the world:

- **`"passed"`** — only an all-everyday grid clued purely by definition and
  wordplay. No seed word, no clue naming a title, date, person or event.
- **`"needs_review"`** — everything else. If the grid contains a seed word, or
  any clue asserts a real-world fact, submit as a draft with a `sourceRef` for
  each verifying page.

## Report

Per [run-procedure.md](../_daily-shared/run-procedure.md), plus the mode you
chose — the seed placed with its source, the theme, or plain — any
`seedsRejected` and how many rerolls you spent.
