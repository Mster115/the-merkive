---
name: daily-merkive-nexus
description: Fills The Merkive's daily Nexus puzzle — a 3x3 trivia grid where every answer must satisfy both its row and its column. Researches and independently double-sources every cell, assembles the grid from facts that already verified, and queues it through the merkive-daily MCP tools. Use when running the scheduled Nexus content fill, when the Nexus queue needs topping up, or when asked to draft or queue Nexus puzzles.
---

# Daily fill — Nexus

You keep The Merkive's Nexus grid supplied with content, running unattended on a
schedule through the `merkive-daily` MCP tools. Handle **nexus only** — Nutshell
and Relay have their own scheduled tasks. Do not submit for them.

Nexus is the one daily game with real fact-check exposure. Everything here exists
because a wrong answer key is asserted to the player as truth, with no appeal.

**Read these first:**

- [Editorial rules](../_daily-shared/editorial.md) — the prime directive, originality, safety
- [Research and sourcing](../_daily-shared/sources.md) — reading the room, the source map, browser policy
- [Run procedure](../_daily-shared/run-procedure.md) — `daily_plan` → `daily_check` → `daily_submit`, and the draft gate
- [Workflow graph](../_daily-shared/workflow-graph.md) — the authoritative control flow: every failure edge, retry budget and terminal state

Deeper background, only if something here is ambiguous:
[docs/daily-content/nexus.md](../../../docs/daily-content/nexus.md) for the full
spec, and `daily_brief` for the live payload schema. Trust `daily_brief` over any
document — the code is the contract.

## Build the pool before you build the grid

**Do not pick a grid and then try to verify nine cells.** A cell that fails
verification has to be replaced by something that still satisfies both its row
and its column, so failures cascade into rework and a run can burn out mid-grid.

Work in the other direction:

1. **Harvest.** Research broadly per [sources.md](../_daily-shared/sources.md)
   and collect candidate facts across **at least six different domains** — sport,
   science, film and TV, music, food, language, history, space, technology, art,
   books, games. Aim for roughly twice the facts you need.

2. **Verify as you harvest.** A candidate enters the pool only once it has **two
   independent Tier-1 sources you actually opened** and agrees across both.
   Official and primary sources, major reference works, wire services. A source
   that would not load verified nothing. Drop anything that does not clear the
   bar rather than carrying it forward "to check later".

3. **Screen for repeats.** Call `daily_history` **once**, with every pooled
   answer in a single batch, and strike anything it reports as already used.
   Do not call it per candidate.

4. **Assemble from what survived.** Choose row and column categories that fit the
   verified pool, then place the answers. Because the pool is already sourced and
   deduped, assembly involves no backtracking into research.

5. **Mix the timescales.** At least three of the nine cells should touch
   something from the last few months, and at least one from the last few weeks.
   The rest should be durable general knowledge — a grid of nothing but current
   events is exhausting and ages badly.

If the pool cannot fill a grid, submit nothing and say so. Do not lower the
sourcing bar to reach nine.

## Grid design

- **Every answer must genuinely satisfy both its row and its column category.**
  That is the premise of the game; one violation costs the player's trust in the
  whole grid.
- **SPREAD THE GRID ACROSS SUBJECTS.** The three row categories must come from
  three different broad domains. Rows of "2026 FIFA World Cup / Milano Cortina
  2026 Winter Olympics / Chemical Elements" are two-thirds sport, and read narrow
  however solid the individual cells are.
- **VARY THE COLUMN AXIS TOO.** If the columns are Europe / Asia / The Americas
  one day, make them a decade, a medium, a material or a first letter the next.
  Geography is the easiest axis to reach for and it goes stale fastest — the same
  grid above used it for all three columns, so the whole puzzle collapsed to
  "sport, by continent".
- Aim for a median solver getting **5–7 of 9**.

## Question writing

- **THE QUESTION MUST PIN DOWN WHICH ONE.** If the answer is a single installment
  of a series — a film, a book, an album, a numbered event — the question must
  name the year, the position, or another marker that rules out the franchise as
  an answer. "Which film features Frodo and Sam?" has no correct single answer;
  "Which 2003 film…" does. The grader will never accept the broader franchise
  name, so an under-specified question marks a player wrong for being right.
- **NO QUESTION MAY CONTAIN ANOTHER CELL'S ANSWER.** All nine questions are
  visible from the first render, so one wording hands a different cell over for
  free. **Check all pairs** before submitting. This is easy to miss: "the element
  named after the Titans" gave away TITAN, and "when a magma reservoir collapses"
  gave away MAGMA, in the same draft.
- List `acceptableAnswers` for abbreviations, spelling variants, transliterations
  and alternative names. Case, spacing, punctuation, accents, a leading
  "a/an/the", numerals-vs-words, and full-name-vs-surname are **already handled
  by the grader** — do not pad the list with those.

## The fact-check bar

Nexus may queue directly. Set `factCheck.status: "passed"` **only when all of the
following hold for all nine cells**:

- Two genuinely independent Tier-1 sources agree, each retrieved by you this run
  — different owners, neither derived from the other, no shared wire copy. See
  [what counts as independent](../_daily-shared/sources.md#what-counts-as-two-independent-sources); two reprints of the same Reuters story is one source
- The fact is **durable**, not a current state — see
  [the durability test](../_daily-shared/sources.md#is-this-fact-durable)
- No cell depends on a fact younger than 72 hours
- No cell touches a living person's private life
- Every question pins down a single answer, and no question leaks another

Anything short of that is `"needs_review"`, which holds the pack as a draft. A
`sourceRef` is required for every cell either way. Never pass a pack because the
queue is short — see the draft gate in
[run-procedure.md](../_daily-shared/run-procedure.md#the-draft--queued-gate).

`"passed"` and `"needs_review"` are the **only** permitted values, sent
literally. Anything else — `"unreviewed"` among them — is rejected outright, so a
typo costs you the run rather than quietly drafting.

## Report

Per [run-procedure.md](../_daily-shared/run-procedure.md), plus **per-cell**
fact-check verdicts with both source URLs, and which cells were browser-verified
rather than fetched.
