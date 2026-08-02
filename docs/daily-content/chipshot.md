# Chip Shot — Daily Content Guide

Chip Shot is a solo mini-golf game where courses are **procedurally generated
from a seed**. The content pack is minimal — just parameters that drive the
deterministic course generator.

## Content Pack Format

| Field              | Type      | Required | Range   | Description                            |
| ------------------ | --------- | -------- | ------- | -------------------------------------- |
| `seed`             | `string`  | ✅        | —       | Deterministic seed for course generation. Recommend `"YYYY-MM-DD-chipshot"`. |
| `holeCount`        | `number`  | ✅        | 1–9     | Holes per round. Standard: **3**.       |
| `difficulty`       | `1\|2\|3` | ✅        | 1–3     | 1 = few obstacles, 2 = medium, 3 = dense. |
| `maxStrokesPerHole`| `number`  | ✅        | 3–15    | Stroke limit per hole. Standard: **8**. |

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
- **Variety**: The seed is the only lever for course variety — different seeds
  produce entirely different tile layouts, obstacle placements, and tee/cup
  positions. No two seeds produce the same course.

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

`seed` — since the seed deterministically produces the entire course, duplicate
seeds mean duplicate puzzles. The platform's `submitPack` canonicalises and
rejects repeats via this fingerprint.

## Auto-Queue Policy

Chip Shot packs use closed-vocabulary procedural generation — no real-world
facts, no trivia, no assertions about living people. Like Relay, packs
**auto-queue directly** without human review, since there is no fact-check
exposure risk. The course is pure geometry driven by a PRNG seed.
