# Chip Shot — Daily Content Guide

Chip Shot is a solo mini-golf game where courses are **procedurally generated
per puzzle date**. The content pack is minimal — just the difficulty knobs
(`holeCount`, `difficulty`, `maxStrokesPerHole`) plus a `seed` uniqueness
token for repeat detection. See "What Actually Generates the Course" below —
`seed` is not a generation input, despite the name.

## Content Pack Format

| Field              | Type      | Required | Range   | Description                            |
| ------------------ | --------- | -------- | ------- | -------------------------------------- |
| `seed`             | `string`  | ✅        | —       | Uniqueness/fingerprint token. Always `"YYYY-MM-DD-chipshot"`. Does **not** drive course generation — see below. |
| `holeCount`        | `number`  | ✅        | 1–9     | Holes per round. Standard: **3**.       |
| `difficulty`       | `1\|2\|3` | ✅        | 1–3     | 1 = few obstacles, 2 = medium, 3 = dense. |
| `maxStrokesPerHole`| `number`  | ✅        | 3–15    | Stroke limit per hole. Standard: **8**. |

## What Actually Generates the Course

The course is built by `generateCourse(ctx.rng, payload)` in
[`logic.ts`](../../packages/games/src/daily/chipshot/logic.ts), and `ctx.rng`
is supplied by the platform as `matchRng(\`${gameId}:${puzzleDate}\`, 0)` (see
`apps/web/src/server/daily/service.ts`) — keyed on the **puzzle date**, never
on `payload.seed`. `generateCourse` only reads `holeCount` and `difficulty`
from the payload; `seed` is stored in `secretState` but nothing ever reads it
back.

Practically: every calendar date already gets a unique tile layout, obstacle
placement, and tee/cup position, with zero input from `seed`. `seed`'s only
real job is downstream — it's the field `submitPack` fingerprints (see
Fingerprint Fields below) to refuse an accidental duplicate submission for the
same date. Always embed the puzzle date in it; don't treat it as a variety
knob, because it isn't one.

## Validation Rules

Enforced by `validatePack` in `packages/games/src/daily/chipshot/pack.ts`:

- `seed`: must be a non-empty string.
- `holeCount`: integer in `[1, 9]`.
- `difficulty`: must be exactly `1`, `2`, or `3`.
- `maxStrokesPerHole`: integer in `[3, 15]`.

## Editorial Guidelines

- **Seed format**: Use `"YYYY-MM-DD-chipshot"` incorporating the puzzle date
  for uniqueness (e.g. `"2026-08-03-chipshot"`).
- **Difficulty schedule**: Difficulty 1 Mon/Tue, 2 midweek, 3 Fri/Sat/Sun.
  This mirrors the casual → challenging weekly rhythm.
- **Hole count**: 3 is the sweet spot for a ~3-minute daily session. Use 1 for
  "express" days or 5 for special events.
- **Max strokes**: 8 is standard. Lower (5–6) for hard days, higher (10–12)
  for easy/accessible days.
- **Variety**: Course variety comes from the puzzle date itself, automatically
  — no authoring input needed. `holeCount` and `difficulty` still shape the
  round (more/fewer holes, obstacle density), so use those to vary the day's
  feel.

## Example Pack

```json
{
  "seed": "2026-08-03-chipshot",
  "holeCount": 3,
  "difficulty": 2,
  "maxStrokesPerHole": 8
}
```

## Fingerprint Fields

`seed` alone — `puzzleItems()`'s `chipshot` case in
[`fingerprint.ts`](../../apps/web/src/server/daily/fingerprint.ts) (and its
copy in `scripts/mcp/daily-mcp.mjs`, which must stay in step) fingerprints on
the normalised `seed` string only, not the rest of the payload. This is a
repeat-*submission* guard, not a repeat-*course* guard — the course itself
can't repeat as long as `puzzleDate` doesn't, regardless of `seed`. Always
follow the `"YYYY-MM-DD-chipshot"` convention so two different dates never
submit the same seed by accident.

## Auto-Queue Policy

Chip Shot packs use closed-vocabulary procedural generation — no real-world
facts, no trivia, no assertions about living people. Like Relay, packs
**auto-queue directly** without human review, since there is no fact-check
exposure risk. The course is pure geometry, generated server-side from the
puzzle date.
