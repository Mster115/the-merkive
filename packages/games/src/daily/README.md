# Daily Games Plugin Contract

This directory defines the single-player "Daily Games" plugin contract for The Merkive (e.g. Wordle or Connections style solo puzzles).

## Why Daily Games are Separate from Room Games

Room-based multiplayer games in `packages/games/src/index.ts` are designed for real-time room sessions with 2–12 seats, Stage (TV) / Controller (phone) UI splits, timers, bot coverage, and lobby settings.

Daily games differ fundamentally:
- **Solo & Single-Screen**: Played by one player directly on a single UI component (`ui.Play`). There is no Stage/Controller split.
- **No Room Lifecycle**: No room codes, seat allocations, timers, or bot replacement.
- **Date-based Puzzles**: Puzzles are indexed by date (`YYYY-MM-DD`), using content packs containing secret answer keys.
- **No `minPlayers` gate**: Daily games are solo-first. They live in `dailyGameRegistry` (`packages/games/src/daily/index.ts`) and must **never** be added to the room-based multiplayer registry in `packages/games/src/index.ts`.

## Core Contract (`DailyGameModule`)

Defined in `packages/games/src/daily/types.ts`:

- `init(ctx, pack)`: Takes a `DailyContext` and a `DailyContentPack` (which includes secret answer data) and returns `{ publicState, secretState, phase }`. Server-only.
- `reduce(ctx, state, action)`: Pure function validating and applying a player action to produce a new state (`DailyReduceResult`) or rejection (`DailyReduceError`).
- `summarize(ctx, state)`: Pure function deriving final `DailySummary` (status, spoiler-free emoji share text, stats) from state. Used both server-side on puzzle completion and client-side for instant share card rendering.
- `ui.Play`: React component rendering the puzzle controller UI.

## Determinism

Daily games use `@merky/game-sdk`'s `matchRng(seed, version)` for deterministic random number generation. The puzzle seed is constructed as:

```ts
const seed = `${gameId}:${puzzleDate}`; // e.g. "nutshell:2026-07-24"
```

All state transitions in `init`, `reduce`, and `summarize` must be pure and deterministic — never use `Math.random()`, `Date.now()`, or I/O. Use `ctx.rng` and `ctx.now` exclusively.

## Content Pipeline Hooks

`DailyGameModule` includes two hooks reserved for the platform's external content pipeline:
- `generatePrompt(puzzleDate)`: The brief handed to whoever (or whatever) authors content for that date — what to research, construct, or verify. It is a plain string with no schema, so it can drift from `validatePack` without anything failing; derive it from the same constants the validator uses where you can. Nutshell does this, building its geometry from `PATTERN_LIBRARY` at call time (`nutshell/prompt.ts`), because a brief describing a layout the solver no longer has produces submissions that are rejected for reasons the author cannot see.
- `validatePack(raw, puzzleDate)`: Validates and normalizes raw generated or ingested pack JSON into a typed `DailyContentPack`. This is the authority — the brief is advice, this is the gate.

**Write the brief for what the validator can actually accept.** Nutshell's originally asked for a loose pool of 15–25 everyday words on the assumption that `solveGrid` would find an interlocking grid inside it. Measured, a pool of ~1,200 curated everyday words yields no grid at all on any of the seven patterns, while ten words chosen to interlock solve instantly — the brief was asking for something the game rejects. Content authoring rules, per-game schemas and the editorial standards live in [docs/daily-content/](../../../../docs/daily-content/README.md).

**`raw` is the submission envelope, not the bare payload.** The pipeline calls
`validatePack({ gameId, puzzleDate, payload, sourceRefs }, puzzleDate)`, so read
your game's fields off `raw.payload` and citations off `raw.sourceRefs`:

```ts
const obj = typeof raw.payload === "object" && raw.payload !== null ? raw.payload : raw;
```

The `?? raw` fallback keeps a bare payload working for tests and direct callers.
Reading game fields off the envelope's top level instead is the one mistake that
unit tests will not catch — a spec that passes a bare payload goes green while
every real submission through `/api/admin/daily/submit-pack` is rejected. Cover
it by asserting the envelope form, as each game's spec does.

Note: The content ingestion and storage pipeline itself is outside this package's scope.

## Registering a Daily Game

To register a new daily game:
1. Implement your game in `packages/games/src/daily/<game-id>/` (or similar daily game module directory).
2. Add an import and export line in `packages/games/src/daily/index.ts`:

```ts
import { myDailyGame } from "./my-daily-game";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "my-daily-game": myDailyGame,
};
```

## Testing

Use `packages/games/src/daily/testing.ts` for writing daily game test suites:

```ts
import { createDailyTestRun, act, actErr } from "../testing";
import { myDailyGame } from "./index";

const run = createDailyTestRun(myDailyGame, {
  puzzleDate: "2026-07-24",
  pack: samplePack,
});

act(run, "guess", { word: "TESTS" });
expect(run.phase).toBe("in_progress");
```
