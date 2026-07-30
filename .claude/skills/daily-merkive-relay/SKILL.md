---
name: daily-merkive-relay
description: Fills The Merkive's daily Relay puzzle — a word-chain game with an intended chain and a bank of plausible dead-end decoys, validated by the daily_check solver. Builds and submits packs through the merkive-daily MCP tools. Use when running the scheduled Relay content fill, when the Relay queue needs topping up, or when asked to draft or queue Relay puzzles.
---

# Daily fill — Relay

You keep The Merkive's Relay word chain supplied with content, running
unattended on a schedule through the `merkive-daily` MCP tools. Handle **relay
only** — Nexus and Nutshell have their own scheduled tasks. Do not submit for
them.

Relay is the cheapest of the three daily games to fill. Its content is
closed-vocabulary wordplay verified by a solver, not claims about the world, so
it carries none of Nexus's fact-check risk. **Do not spend a research budget
here** — a light touch of theme is all the topicality this game needs.

**Read these first:**

- [Run procedure](../_daily-shared/run-procedure.md) — `daily_plan` → `daily_check` → `daily_submit`, and the draft gate
- [Workflow graph](../_daily-shared/workflow-graph.md) — the authoritative control flow: every failure edge, retry budget and terminal state
- [Editorial rules](../_daily-shared/editorial.md) — originality, safety, language

Only if you decide to theme the bank:
[Research and sourcing](../_daily-shared/sources.md).

Deeper background, only if something here is ambiguous:
[docs/daily-content/relay.md](../../../docs/daily-content/relay.md) for the full
spec, and `daily_brief` for the live payload schema. Trust `daily_brief` over any
document — the code is the contract.

## The mechanic

Each word's **first letter must match the previous word's last letter** —
`STONE → ECHO → OASIS → SNOW → WHALE`. This is not a letter-ladder; letters are
never changed within a word. The player only ever picks from the bank, never
types. **The bank is the puzzle.**

## Building a chain

- Aim for a **4–6 word intended chain** after the start, and a **12–18 word
  bank**. Under ~10 is trivial; over ~20 turns a 3-minute puzzle into a search.
- **Build forwards:** pick `startWord`, then each next word beginning with the
  previous word's last letter, until you land on a satisfying `endWord`. Add
  decoys afterwards.
- **Chaining letters decide everything.** Words ending in `E`, `S`, `T`, `R`,
  `N`, `D` give the most continuations. Words ending in `X`, `J`, `Q`, `V`, `Z`
  are dead ends — excellent decoys, disastrous mid-chain.
- **Vocabulary:** common English words only. No proper nouns, abbreviations or
  archaic fill. 3–8 letters reads best on a phone.
- **A–Z only.** The normalizer upper-cases but does **not** strip punctuation, so
  a hyphenated entry like `WELL-FED` becomes a bank word nothing can ever match.

- **Interleave the chain with the decoys** in the submitted `wordBank` array.
  Building forwards makes it natural to list the intended chain first and append
  the decoys, which reads as the answer written down the top of the bank. The
  runtime shuffles the bank per attempt, so this no longer reaches players — but
  a chain-ordered array still makes the pack unreviewable at a glance.

### Decoys — the actual craft

- Words that *do* chain from the current position but dead-end (nothing in the
  bank starts with their last letter).
- Words matching a wrong-but-tempting letter.
- At least one word that chains late but is unreachable from the start.

### You must check for alternate routes yourself

**`daily_check` will not catch a second solution.** The solver is depth-first
with no reuse, and returns the **first** path it finds — not the shortest. That
path is what `parMoves` records, and the validator will happily accept a bank
with three solutions.

So a pack passing `daily_check` proves only that it is *solvable*, never that it
is solvable *the way you intended*. Before submitting, walk the bank yourself and
confirm no decoy opens a shorter or alternate route to `endWord`. Also confirm
the intended chain link-by-link, and that no word appears twice.

## Theming

Theme the word bank loosely around something in the air this week — a sporting
event, a season, a release — **when the letters allow it**. The chain constraint
always wins: **drop the theme rather than mangle the chain for it.**

Plain unthemed banks are a perfectly good outcome and should be the default on
any day where a theme does not fall out naturally.

## The fact-check bar

Relay is closed-vocabulary wordplay verified by the solver, so **the normal case
is `factCheck.status: "passed"`, and it queues directly.** Send that string
literally.

There is no "not applicable" here. Asserting no facts *is* how Relay meets its
bar, so it passes — marking it anything else strands a puzzle that needed no
review and leaves the queue a day shorter than you think.

The one exception: if you theme the bank in a way that **asserts a real-world
fact** — a title, a date, a person, an event — that assertion needs a source like
any other, and the pack goes in as `"needs_review"` with a `sourceRef`. A bank of
ordinary words that merely evokes autumn asserts nothing and stays `"passed"`.

Those two strings are the only permitted values; anything else is rejected. See
[the gate](../_daily-shared/run-procedure.md#the-draft--queued-gate).

## Report

Per [run-procedure.md](../_daily-shared/run-procedure.md), plus the theme you
used (or that you went plain), the intended chain and its `parMoves`, and
confirmation that you checked the bank for alternate routes.
