# Daily Content Pipeline — grounding documents

These documents exist so the **recurring content tasks** (three local scheduled
tasks, one per game) can queue daily puzzles for The Merkive without a human
re-deriving the contract every time, and without inventing facts.

They are the source of truth for *content*. The source of truth for *code* is
`packages/games/src/daily/` — if a schema here disagrees with `validatePack`,
the code wins and this document is a bug.

| Document | What it covers |
| --- | --- |
| [pipeline-api.md](pipeline-api.md) | Endpoints, auth, submission envelope, draft-vs-queued, the overwrite hazard |
| [editorial-standards.md](editorial-standards.md) | Sourcing tiers, the fact-check rubric, originality, difficulty, safety, repeats |
| [nexus.md](nexus.md) | Nexus payload schema + trivia-specific rules (the game with real fact-check exposure) |
| [nutshell.md](nutshell.md) | Nutshell candidate-pool schema + what the grid solver can actually fill |
| [relay.md](relay.md) | Relay word-chain schema + solver constraints |
| [mcp-server.md](mcp-server.md) | **The `merkive-daily` MCP server** — tools, selective disclosure, never-repeat enforcement, setup |
| [scheduled-tasks.md](scheduled-tasks.md) | **How the fill actually runs** — the three per-game skills, timing, why it is split |

The instructions the tasks follow are **skills in this repo**, under
`.claude/skills/daily-merkive-*`. Nothing embeds a copy of them; see
[scheduled-tasks.md](scheduled-tasks.md).

The pipeline is driven through the [MCP server](mcp-server.md): the tasks
call tools that enforce the rules, rather than reciting rules they might forget.
Rules that can be executed are executed, not documented:
[`scripts/daily-content.mjs`](../../scripts/daily-content.mjs) enforces the
API's sharp edges (date arithmetic, overwrite protection, draft collisions) so
nobody has to remember them, and
[`packages/games/src/daily/nutshell/prompt.ts`](../../packages/games/src/daily/nutshell/prompt.ts)
derives Nutshell's content brief from `PATTERN_LIBRARY` so the geometry it
quotes cannot drift from the solver's. Both are covered by tests.

## The operating model

```
each task (daily, via the merkive-daily MCP tools)
  → daily_plan     which dates are actually open, for this game
  → daily_brief    the game's own authoring brief
  → daily_grid     a verified, never-used Nutshell interlock, optionally
                   built around a topical seed answer or a loose theme
  → daily_history  which candidate answers are already spent
  → daily_check    dry run against every rule
  → daily_submit   refuses past dates, taken dates, repeat puzzles
human (you)
  → pnpm daily review          drafts awaiting a decision
  → pnpm daily decide <id> --approve
```

The `draft` / `queued` split is the safety valve: a pack only goes live
unreviewed when it carries `factCheck.status === "passed"`. Approval is
deliberately not an MCP tool — deciding what goes live is not a task's job.

For hands-on work there is the CLI:

```bash
node scripts/daily-content.mjs secret                  # is the secret configured?
node scripts/daily-content.mjs status                  # queue, drafts, next free date
node scripts/daily-content.mjs verify pack.json        # offline preflight
node scripts/daily-content.mjs submit pack.json --yes  # guarded submit
node scripts/daily-content.mjs review
node scripts/daily-content.mjs decide <id> --approve
```

`submit` refuses, rather than warns, on the ways to destroy content: a
`puzzleDate` that is not in the future, a date that already holds a queued
puzzle or a pending draft, and a puzzle whose content has been used before.
`--force` overrides the date checks deliberately; the repeat check is enforced
server-side and cannot be overridden.

## Never repeating a puzzle

`submitPack` fingerprints every pack's assembled answer key and rejects a
repeat with `409 duplicate_puzzle`, whatever submits it. Fingerprints are
canonical — sorted, trimmed, lower-cased — so a reshuffled bank or reordered
cells is still the same puzzle, and Relay keys on the start/end pair because
different decoys around one chain play identically. Details in
[mcp-server.md](mcp-server.md#never-repeating-a-puzzle).

## What may go live unreviewed

Nexus is trivia about the real world, so somebody has to decide what counts as
sourced well enough to go live without a human looking at it. **Decided
2026-07-28: auto-queue on a hard evidence bar.**

A Nexus pack may carry `factCheck.status: "passed"` — and so queue directly —
only when **all nine cells** clear every one of these:

- ≥2 independent Tier-1 sources that agree, each retrieved during that run
- No cell depends on a fact newer than 72h
- No cell is about a living person's private life
- Every question pins down a single answer, and no question leaks another cell's

Anything short of that is `"needs_review"` and waits in `pnpm daily review`. The
rubric is in [editorial-standards.md](editorial-standards.md#3-fact-check-rubric);
the bar is enforced in
[the Nexus skill](../../.claude/skills/daily-merkive-nexus/SKILL.md).

Rejected: **draft-only**, which is safer but advances the queue only when you
show up; and **auto-queue everything**, because a wrong answer key is worse than
an empty queue — the game asserts it confidently to the player with no appeal.

Relay does not carry this risk (closed-vocabulary word puzzles verified by a
solver, not claims about the world), so it auto-queues regardless. Nutshell is
the same *only* for all-everyday grids clued by definition and wordplay — a grid
built around a topical seed word, or clued through real events, asserts facts and
always lands as a draft. See each game doc.

## When you change a game

If you touch a daily game's `validatePack`, `generatePrompt`, or payload types,
update the matching document here **and** the corresponding skill under
`.claude/skills/daily-merkive-*` in the same PR.

The tasks read those skills from this repo, so there is no copy to re-paste — but
they only see the schema through `daily_brief` and whatever the skill states, so
a skill left stale is a schema the fill never learns about.
