# The Merkive — Engineering Contracts

Read this before touching any code. The platform spine is **built, tested, and
frozen**. Game plugins and adapters build against these contracts; do not
modify anything outside your ownership zone.

## Architecture in 60 seconds

- Monorepo (pnpm): `apps/web` (Next.js 15 App Router), `packages/game-sdk`
  (plugin contract — **read `packages/game-sdk/src/types.ts` in full**),
  `packages/games` (plugins), `packages/ui` (design system), `packages/db`
  (Supabase migrations).
- Server is authoritative. Clients POST intents to
  `/api/rooms/[code]/action`; the service loads state, calls the game's pure
  `reduce`, persists with a version CAS, and broadcasts patches.
- Two storage/realtime adapters behind one interface
  (`apps/web/src/server/store/types.ts`): **MemoryStore** (in-process + SSE,
  dev) and **SupabaseStore** (Postgres + Supabase Realtime, prod).
- Rooms: 4-char codes, ≤8 seats, spectators, host transfer, disconnect
  graces (player 60s → seat abandoned), timers, bot coverage of abandoned
  seats, expiry sweeper. All implemented in
  `apps/web/src/server/{service,runtime}.ts` — already tested, do not edit.

## State semantics (must-know for game authors)

- A match has `version` starting at 0; `init` runs at version 0; every
  applied `ReduceResult` bumps version by exactly 1.
- `ctx.rng` is seeded from `(matchSeed, version)` — fully deterministic and
  replayable. **Never** use `Math.random()` or `Date.now()` in game code; use
  `ctx.rng` and `ctx.now`.
- `ReduceResult.privateState`: per-seat **full replacement**; omitted seats
  keep previous private state. Clients only ever receive their own seat's
  private state.
- `ReduceResult.scores`: **cumulative totals**, not deltas; omitted seats
  keep previous totals. These drive the shell scoreboard + podium.
- `ReduceResult.timer`: `{ endsAt: ctx.now + ms, kind, durationMs }` starts a
  timer; `null` clears; `undefined` keeps the current one. When it expires the
  server calls `onTick` (driven by a sweeper in dev and by client nudges —
  don't rely on exact firing time; late ticks are normal).
- `awaitedSeats(ctx, state)` = seats whose input the game currently waits on.
  Exclude seats where `ctx.seats[..].abandoned` is true if their input is no
  longer expected. Used for bot coverage: for each awaited+abandoned seat the
  server calls `suggestBotAction` and applies the returned action through
  `reduce` (so bots can never cheat).
- Completion checks inside `reduce` must treat abandoned seats
  (`ctx.seats[i].abandoned`) as not-expected (e.g. "all players submitted"
  means all non-abandoned players).
- Reject invalid intents by returning `{ error, code }` (snake_case code) —
  never throw. The platform relays it to the acting client only.
- Phase names are yours; use `"game_over"` for the final phase and set
  `matchOver: true` exactly once. The platform then finalizes the match and
  returns the room to the lobby with a podium (from `scores`).
- `events` are broadcast to all clients and appended to the audit log; use
  them for toast/animation cues, keep payloads small.

## UI slot contracts

Games ship `ui.Stage` (TV, big, read-only) and `ui.Controller` (phone,
interactive) React components — props in `packages/game-sdk/src/types.ts`
(`StageProps`, `ControllerProps`). Rules:

- The shell already renders: header (game name, room code, timer bar from
  `match.timer`, host end-game), footer scoreboard (Stage), reconnect
  overlay. **Do not** render your own global timer bar or scoreboard; render
  phase-specific UI only.
- `now` prop is a server-adjusted ticking clock (~2Hz) for countdown display.
- `act(type, payload)` returns `{ok:false, code, error}` on rejection —
  surface it inline (small red text), don't alert().
- Mobile-first controllers: min 44px touch targets, no hover-only
  affordances, works at 360px width. Stage must read at 10ft: huge type.
- Use `@merky/ui` components (`Button`, `Card`, `Panel`, `PlayerChip`,
  `Pill`, `ScoreBoard`, `Modal`, `AvatarFace`, `cn`) + Tailwind classes +
  the CSS variables from `packages/ui/src/tokens.css`
  (`--mb-accent`, `--mb-surface`, etc.) following the neo-brutalist spec in
  [DESIGN.md](DESIGN.md). Loud, chunky, high-contrast, but
  clean hierarchy. Respect `prefers-reduced-motion` (tokens.css handles the
  global kill-switch; avoid motion-critical UX).
- Accessibility: every interactive element gets an accessible name; phase
  changes should live in an `aria-live="polite"` region; don't convey state
  by color alone (pair icons/text).
- All strings through `t(key)` with keys `games.<id>.*` declared in the
  module's `i18n.en` map. No hardcoded English in JSX. Interpolation:
  `t("games.x.hello", { name })` replaces `{name}`.

## Test harness

`@merky/game-sdk/testing` mirrors server semantics exactly:

```ts
import { createTestMatch, act, actErr, fireTimer, abandonSeat, botStep } from "@merky/game-sdk/testing";
const m = createTestMatch(zaplash, { players: 4, seed: "golden-1" });
act(m, 0, "submit_answer", { promptIndex: 0, text: "haha" });
actErr(m, 1, "vote", { ... });         // expect rejection
fireTimer(m);                           // jump to timer deadline, run onTick
abandonSeat(m, 2); botStep(m);          // abandon + bot coverage
m.state.phase, m.scores, m.log, m.state.privateState[0]  // assertions
```

Tests live in `packages/games/src/<id>/__tests__/*.spec.ts` (vitest picks
them up automatically).

## Commands

- `pnpm --filter @merky/games test` — game tests
- `pnpm --filter @merky/web test` — platform tests (must stay green)
- `pnpm -r typecheck` — must be clean before you're done
- TypeScript is strict with `noUncheckedIndexedAccess` — handle `undefined`
  on every index access.

## Hard rules

1. Touch **only** files inside your ownership zone (your task prompt lists
   it). Never edit: SDK, `packages/ui`, `packages/games/src/index.ts`
   (registry — already wired), other games' folders, the web app service/
   runtime/routes, any `package.json`, or the lockfile.
2. No new dependencies. No `pnpm install`. No dev servers, no browsers, no
   git commands. Node's stdlib + existing deps only.
3. Your module must export the exact same named export the stub has
   (`zaplash` / `eightstorm` / `tiletangle`) via `defineGame(...)` from
   `@merky/game-sdk`, from `packages/games/src/<id>/index.tsx` (you may split
   internals into extra files in your folder: `logic.ts`, `Stage.tsx`,
   `Controller.tsx`, `__tests__/…`).
4. Reducers must be pure: no I/O, no Date.now, no Math.random, no mutation of
   the incoming `state` object (always return fresh objects).
5. Keep `meta.id`, min/max players, and i18n key prefixes exactly as
   specified in your task.
6. Done = your tests pass + `pnpm -r typecheck` clean + registry test suite
   (`packages/games/src/__tests__/registry.spec.ts`) still green.
