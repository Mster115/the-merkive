---
name: daily-merkive-chipshot
description: >
  Generates and submits Chip Shot daily mini-golf puzzle packs.
  Chip Shot uses procedural course generation keyed on the puzzle date —
  content packs are minimal (difficulty parameters + a seed uniqueness token).
---

# Chip Shot — Daily Content Pipeline Skill

You are generating daily Chip Shot mini-golf puzzles for The Merkive.

## Game Overview

Chip Shot is a solo daily mini-golf game where the player aims and shoots a
ball through procedurally generated courses. The course is built from pre-built
tile templates (straight, corner, dogleg, open, funnel) with randomly placed
obstacles (walls, bumpers, sand traps, water hazards). The player controls only
angle and power — two inputs.

## Content Pack Schema

```json
{
  "seed": "YYYY-MM-DD-chipshot",
  "holeCount": 3,
  "difficulty": 2,
  "maxStrokesPerHole": 8
}
```

### Fields

| Field              | Type   | Range | Standard | Description                              |
| ------------------ | ------ | ----- | -------- | ---------------------------------------- |
| `seed`             | string | —     | —        | Uniqueness/fingerprint token, not a generation input. Use `"YYYY-MM-DD-chipshot"`. |
| `holeCount`        | number | 1–9   | 3        | Holes per round.                          |
| `difficulty`       | number | 1–3   | 2        | 1 = easy, 2 = medium, 3 = hard.          |
| `maxStrokesPerHole`| number | 3–15  | 8        | Stroke limit before forced hole advance.  |

**`seed` does not generate the course.** The server derives `ctx.rng` from
`gameId:puzzleDate`, so every date's tile layout, obstacles, and tee/cup
positions are already unique with zero input from this field. `seed`'s only
job is the anti-repeat fingerprint (see below) — it still must follow the
date-embedded format below, or a legitimate new date's submission can collide
with an old one.

## Workflow

1. **`daily_plan`** — Check which upcoming dates have no Chip Shot puzzle queued.
2. **`daily_brief`** — Retrieve the authoring prompt (calls `generatePrompt`).
3. **Generate pack** — Construct the JSON payload using the date as seed basis.
4. **`daily_check`** — Dry-run validation.
5. **`daily_submit`** — Submit. Auto-queues (no human review needed — closed
   vocabulary procedural generation, no fact-check exposure).

## Difficulty Schedule

- Monday / Tuesday → `difficulty: 1`
- Wednesday / Thursday → `difficulty: 2`
- Friday / Saturday / Sunday → `difficulty: 3`

## Seed Construction

Always use `"YYYY-MM-DD-chipshot"` format incorporating the puzzle date:
- `"2026-08-03-chipshot"` for August 3rd
- `"2026-08-04-chipshot"` for August 4th

The course is already unique per date regardless of this field — this
convention exists so the fingerprint (which hashes `seed` alone) never
collides between two legitimately different dates. Duplicate seeds are
rejected by the platform as repeat submissions.

## Auto-Queue Eligibility

Chip Shot packs always auto-queue. There are no real-world facts, trivia, or
assertions — just PRNG-driven geometry. No `factCheck` field is needed.
