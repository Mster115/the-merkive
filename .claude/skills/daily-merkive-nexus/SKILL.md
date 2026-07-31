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
## Difficulty — calibrate it deliberately

Players tell us Nexus is the most interesting of the daily games and, by a wide
margin, the hardest. Left uncalibrated a grid drifts hard, because a cell that was
interesting enough to research is usually a cell most people cannot answer.

Assign every cell a tier before you submit, and hit this mix:

| Tier | Count | Test |
|---|---|---|
| Approachable | **3** | A generally-informed solver answers it with no lookup and no hesitation |
| Medium | **4** | They know the domain, or get there by reasoning from the two categories |
| Hard | **at most 2** | Genuinely specialist, or a fact you had to dig for |

- A median solver should get **6–7 of 9**. If your tiers don't add up, the grid is
  too hard — swap a hard cell for a pooled candidate, not the other way round.
- **The approachable three are not filler.** They are what makes the grid feel
  solvable enough to keep going, and they still have to satisfy both categories
  and clear the same sourcing bar.
- Players can take **hints** — the answer's shape, then its initials, then every
  other letter — each costing a point step. That is a safety net for the two hard
  cells. It is **not** a licence to raise the floor: a grid that assumes hints is
  a grid that reads as unfair to anyone who refuses them.
- If you cannot find three approachable cells that fit your categories, the
  categories are too narrow. Change the axis rather than shipping a nine-hard grid.

## Question writing

- **THE QUESTION MUST PIN DOWN WHICH ONE.** If the answer is a single installment
  of a series — a film, a book, an album, a numbered event — the question must
  name the year, the position, or another marker that rules out the franchise as
  an answer. "Which film features Frodo and Sam?" has no correct single answer;
  "Which 2003 film…" does. The grader will never accept the broader franchise
  name, so an under-specified question marks a player wrong for being right.
- **THE QUESTION MUST NOT IDENTIFY ITS OWN ANSWER.** If the question names the
  thing it is asking for, there is no fact left to recall — the player is reduced
  to guessing which wording your key happens to use, which feels like a trick.
  Reported live: *"Which **2024 Summer Games** became the first in Olympic history
  to field an equal number of male and female athletes?"* There is exactly one
  2024 Summer Games; the question hands it over and then asks the player to
  produce a label. The same grid asked *"Which Japanese breaker, competing as
  **B-Girl Ami**, won the first Olympic gold in breaking?"* for an answer of Ami
  Yuasa. The player's words: **"I would never have guessed that's what they were
  looking for."**
  - Test: cover the answer and read the question. If it still picks out exactly
    one thing in the world, rewrite it — ask for something the sentence does not
    already contain. *"Which host city staged the first Olympics with equal
    numbers of male and female athletes?"* asks for a fact; the original asked
    for a spelling.
  - `daily_check` now rejects a question that reuses any distinctive word of its
    own answer, but it cannot catch the paraphrased version. That one is on you.
- **SAY WHAT SHAPE THE ANSWER TAKES, or accept every shape.** An answer with more
  than one natural form — an Olympics ("Paris 2024" / "Paris" / "the 2024 Summer
  Olympics"), a war, a treaty, an award ceremony — must either be pinned by the
  question ("which host **city**") or list every reasonable form in
  `acceptableAnswers`. Marking a player wrong over the format of an answer they
  knew is the fastest way to lose them.
- **NO QUESTION MAY CONTAIN ANOTHER CELL'S ANSWER.** All nine questions are
  visible from the first render, so one wording hands a different cell over for
  free. **Check all pairs** before submitting. This is easy to miss: "the element
  named after the Titans" gave away TITAN, and "when a magma reservoir collapses"
  gave away MAGMA, in the same draft.
- List `acceptableAnswers` for abbreviations, spelling variants, transliterations
  and alternative names. Case, spacing, punctuation, accents, a leading
  "a/an/the", numerals-vs-words, and full-name-vs-surname are **already handled
  by the grader** — do not pad the list with those.

## Hints

Each cell takes an optional `hint`: one short nudge, **≤120 characters**, that is
the first rung of that cell's hint ladder. After it come three computed rungs the
game generates for free — the answer's shape, its initials, then every other
letter — so a hint you write is the only rung that can carry meaning.

**Write one for every medium and hard cell.** The approachable three do not need
one. A grid with no hints at all is flagged by `daily_check`.

A hint has to earn its cost, because the player pays a scoring step to read it:

- **Narrow the field, never name the answer.** `validatePack` rejects a hint that
  contains its own answer or any `acceptableAnswers` entry, and a hint that gets
  there by an obvious synonym is just as bad — it charges the player for what they
  already had. For an answer of *Marie Curie*: "The only person to win in two
  different sciences" ✅. "A Polish-French physicist named Curie" ❌.
- **Give a second route in, not a smaller version of the question.** The good hint
  approaches from a different direction — a date, a rival, a consequence, a place.
  Restating the question in fewer words helps nobody.
- **Never leak another cell's answer**, same rule as questions — check hints
  against all nine answers, not just their own.
- Hints are held server-side until bought, so they do not leak from the first
  render the way questions do. They still ship in the pack, so they carry the same
  accuracy bar as everything else: a wrong hint is a wrong fact.

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

Also report the **difficulty tier of each cell** and the resulting 3/4/2 tally.
This is a self-check in your report only — tiers are not part of the pack payload
and must not be added to it. If the tally is off, fix the grid before submitting
and report the corrected one; do not submit a grid and note that it skews hard.
