# The daily fill — how it runs

Four scheduled tasks keep the daily queues topped up, one per game. They run
locally on the operator's Mac, in this repo's folder, through the
[`merkive-daily` MCP server](mcp-server.md).

## There is no separate prompt to maintain

The instructions live in this repo as skills, and **nothing anywhere embeds a
copy of them**:

| Skill | Fills |
| --- | --- |
| [`.claude/skills/daily-merkive-nexus/`](../../.claude/skills/daily-merkive-nexus/SKILL.md) | Nexus |
| [`.claude/skills/daily-merkive-nutshell/`](../../.claude/skills/daily-merkive-nutshell/SKILL.md) | Nutshell |
| [`.claude/skills/daily-merkive-relay/`](../../.claude/skills/daily-merkive-relay/SKILL.md) | Relay |
| [`.claude/skills/daily-merkive-waypoint/`](../../.claude/skills/daily-merkive-waypoint/SKILL.md) | Waypoint |
| [`.claude/skills/_daily-shared/`](../../.claude/skills/_daily-shared/) | Shared references — see below |

The shared references load only when a run needs them:

| File | Covers |
| --- | --- |
| [`workflow-graph.md`](../../.claude/skills/_daily-shared/workflow-graph.md) | **The authoritative control flow** — node graph, failure edge per error class, retry budgets, terminal states |
| [`run-procedure.md`](../../.claude/skills/_daily-shared/run-procedure.md) | The four steps in prose, the draft gate, reporting |
| [`sources.md`](../../.claude/skills/_daily-shared/sources.md) | Reading the room, durability test, verified feeds, source independence, fetch-failure taxonomy, browser policy |
| [`clue-craft.md`](../../.claude/skills/_daily-shared/clue-craft.md) | Crossword clue conventions — Nutshell only |
| [`editorial.md`](../../.claude/skills/_daily-shared/editorial.md) | Prime directive, originality, safety, variety |

Each scheduled task's own instruction body is a single line — `/daily-merkive-nexus`
and so on — so editing a skill file here changes what the next run does. There is
no re-pasting step, and no second copy that can drift.

> **History.** Until 2026-07-28 the fill was one combined task whose prompt was a
> hand-pasted copy of a fenced block in this file. The copy drifted in both
> directions: the live task never received the "pin down which installment"
> grading rule, while source-map and grid-variety rules learned during real runs
> never made it back to the repo. Splitting per game and pointing the tasks at
> version-controlled skills removes the copy that caused it.

## Why one task per game and not one for all

The games have very different costs and needs, and one task meant one model and
one failure domain for all three:

- **Nexus** is research-heavy — nine cells, two independent sources each — and
  benefits from browser access to the 403-blocked reference tier. Highest model.
- **Nutshell** is solver-driven; `daily_grid` builds the interlock, so the work
  is seed selection and clue writing.
- **Relay** is closed-vocabulary wordplay verified by a solver. Cheapest by far,
  and needs no research budget.
- **Waypoint** has no solver at all. Its cost is a coordinate-verification pass
  over the whole bank — durable facts, so no topicality budget, but nothing in
  the pipeline catches a wrong latitude.

Splitting also means a Nexus run that burns out on verification no longer
consumes the run before Nutshell is reached.

## Timing

Staggered in the small hours, US Eastern. The games flip once, globally, at
**midnight US Eastern** — that is the only deadline that matters. Running shortly
after the flip means `daily_plan` sees the new day, the queue is topped up almost
a full day before it is needed, and any drafts are waiting at breakfast with the
whole day left to review them.

Each run fills up to 3 days per game, so one missed run is recoverable. A late
run is harmless too: the tasks never compute dates, they ask `daily_plan`.

Local scheduled tasks only fire while the desktop app is running and the machine
is awake; a slept-through run is skipped, and the app starts one catch-up run on
wake for the most recent missed slot.

## What the tasks no longer have to be told

The prompt shrank by more than half when the rules moved into tools, and again
when it split per game. Now enforced rather than recited: date arithmetic and the
contiguous-queue assumption (`daily_plan` returns real dates), the payload schemas
(`daily_brief`), the no-repeat ledger (`daily_history`, and `daily_submit`
refuses), the overwrite hazards (`daily_submit` refuses), the pipeline secret (the
MCP server reads it from the Keychain), and crossword construction (`daily_grid`
does it).

## If you are running the pipeline by hand

The same pipeline is available as `pnpm daily <status|plan|verify|submit|review|
decide>` and reads the same Keychain secret. Prefer the MCP tools in automation:
they enforce the repeat and overwrite rules identically and do not depend on a
working directory.
