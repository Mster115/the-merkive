# Daily Content Pipeline — grounding documents

These documents exist so a **recurring content routine** (currently: a Claude
Desktop routine) can queue daily puzzles for The Merkive without a human
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
| [routine-system-prompt.md](routine-system-prompt.md) | **Paste-ready system prompt** for the Claude Desktop routine, plus timing |

The pipeline is driven through the [MCP server](mcp-server.md): the routine
calls tools that enforce the rules, rather than reciting rules it might forget.
Rules that can be executed are executed, not documented:
[`scripts/daily-content.mjs`](../../scripts/daily-content.mjs) enforces the
API's sharp edges (date arithmetic, overwrite protection, draft collisions) so
nobody has to remember them, and
[`packages/games/src/daily/nutshell/prompt.ts`](../../packages/games/src/daily/nutshell/prompt.ts)
derives Nutshell's content brief from `PATTERN_LIBRARY` so the geometry it
quotes cannot drift from the solver's. Both are covered by tests.

## The operating model

```
routine (daily, via the merkive-daily MCP tools)
  → daily_plan     which dates are actually open, per game
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
deliberately not an MCP tool — deciding what goes live is not the routine's job.

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

## Open decision (yours, not the routine's)

Nexus is trivia about the real world, so somebody has to decide what counts as
sourced well enough to go live unreviewed. Three positions, cheapest first:

1. **Draft-only (the current default).** The routine never sets
   `factCheck.status: "passed"`; every pack waits for you in `/review`. Safe,
   but the queue only advances when you show up.
2. **Auto-queue on a hard evidence bar.** The routine may pass a pack only when
   every one of the 9 cells has ≥2 independent Tier-1 sources that agree, no
   cell depends on a fact newer than 72h, and no cell is about a living
   person's private life. Anything short of that stays a draft. The rubric is
   already written in [editorial-standards.md](editorial-standards.md#fact-check-rubric)
   — adopting this is one line change in the system prompt.
3. **Auto-queue everything.** Not recommended; a wrong answer key is worse
   than an empty queue, because the game asserts it confidently to the player.

Until you pick, the routine runs mode 1. Relay does not carry this risk (its
content is closed-vocabulary word puzzles verified by a solver, not claims
about the world), so it can auto-queue regardless. Nutshell is the same *only*
for all-everyday grids clued by definition and wordplay — a grid built around a
topical seed word, or clued through real events, asserts facts and always lands
as a draft — see each game doc.

## When you change a game

If you touch a daily game's `validatePack`, `generatePrompt`, or payload types,
update the matching document here **and** the embedded schema block in
[routine-system-prompt.md](routine-system-prompt.md), then re-paste the system
prompt into the routine. The routine has no repo access; its copy of the schema
is the only one it sees.
