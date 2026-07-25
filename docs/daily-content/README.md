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
| [routine-system-prompt.md](routine-system-prompt.md) | **Paste-ready system prompt** for the Claude Desktop routine (self-contained) |

Rules that can be executed are executed, not documented:
[`scripts/daily-content.mjs`](../../scripts/daily-content.mjs) enforces the
API's sharp edges (date arithmetic, overwrite protection, draft collisions) so
nobody has to remember them, and
[`packages/games/src/daily/nutshell/prompt.ts`](../../packages/games/src/daily/nutshell/prompt.ts)
derives Nutshell's content brief from `PATTERN_LIBRARY` so the geometry it
quotes cannot drift from the solver's. Both are covered by tests.

## The operating model

```
routine (daily)
  → GET  /api/admin/daily/queue-status      how many future days are filled?
  → pick the first unfilled date per game
  → research + fact-check (Nexus) / generate (Nutshell, Relay)
  → POST /api/admin/daily/submit-pack       lands as `draft` or `queued`
human (you)
  → GET  /api/admin/daily/review            list drafts
  → POST /api/admin/daily/review/{id}/decide  approve → queued, reject → deleted
```

Driven through the CLI, that is:

```bash
node scripts/daily-content.mjs status                  # queue + drafts + next free date
node scripts/daily-content.mjs plan --lookahead 5      # which dates to fill
node scripts/daily-content.mjs verify pack.json        # offline preflight
node scripts/daily-content.mjs submit pack.json --yes  # guarded submit
node scripts/daily-content.mjs review                  # drafts (payloads opt-in)
node scripts/daily-content.mjs decide <id> --approve
```

`submit` refuses, rather than warns, on the three ways to destroy content: a
`puzzleDate` that is not in the future, a date inside the already-queued
window, and a date that already has a draft awaiting review. `--force`
overrides deliberately; without `--yes` it is a dry run.

The `draft` / `queued` split is the safety valve. `submitPack` only queues
directly when the submission carries `factCheck.status === "passed"`; anything
else waits for your approval. **The routine ships with auto-queue off** — see
"Open decision" below.

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

Until you pick, the routine runs mode 1. Nutshell and Relay do not carry this
risk (their content is closed-vocabulary word puzzles verified by a solver, not
claims about the world), so they can auto-queue regardless — see each game doc.

## When you change a game

If you touch a daily game's `validatePack`, `generatePrompt`, or payload types,
update the matching document here **and** the embedded schema block in
[routine-system-prompt.md](routine-system-prompt.md), then re-paste the system
prompt into the routine. The routine has no repo access; its copy of the schema
is the only one it sees.
