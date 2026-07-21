# @merky/game-sdk — Game Plugin SDK

The contract between The Merkive platform and every game. Games are pure,
deterministic state machines with React UI slots; the platform owns rooms,
seats, transport, persistence, timers, bots, and versioning. This document is
the canonical reference for **building a game** and the rulebook for
**changing the SDK itself**.

Companion docs: [CONTRACTS.md](../../CONTRACTS.md) (engineering contracts),
[DESIGN.md](../../DESIGN.md) (visual system). Source of truth for types:
[`src/types.ts`](src/types.ts).

---

## 1. Anatomy of a game

```
packages/games/src/<id>/
  index.tsx        defineGame({...}) — named export `<id>`, meta, i18n, wiring
  logic.ts         pure init/reduce/onTick/awaitedSeats/bot helpers
  Stage.tsx        TV view (read-only, 10-ft legible)
  Controller.tsx   phone view (interactive, 360px-wide safe)
  LobbyOptions.tsx optional pretty settings panel for the lobby
  packs.ts         optional built-in content packs
  __tests__/<id>.spec.ts  harness tests (vitest picks these up)
```

Register in `packages/games/src/index.ts` (one import + one registry entry +
pack `gameIds`) and add a `GameIcon` case in `packages/ui/src/icons.tsx`.
Nothing in `apps/web` changes to add a game.

## 2. The three state slots — who sees what

| Slot | Client visibility | Update semantics |
| :--- | :--- | :--- |
| `publicState` | **Broadcast verbatim to every client** (all phones + TV) | Full replacement every result |
| `privateState[seat]` | Each client receives **only its own seat's slice**; server-side callbacks receive the full map | Per-seat **full replacement**; omitted seats keep previous |
| `secretState` | **No client, ever.** Server-only; excluded from views/snapshots/patches by construction (platform-tested) | Omit key = keep previous; any present value (incl. `null`) = full replacement |

**The security rule.** Underscore prefixes, "internal" naming, and obscurity do
NOT hide data — if it's in `publicState`, any player can read it in devtools.
Roles, decks, hidden targets, uncast votes, unrevealed results:
- knowledge that legitimately belongs to one seat → that seat's `privateState`
- knowledge that belongs to no seat (deck order/composition, hidden aggregates)
  → `secretState`

A social-deduction game once shipped roles + deck order in `publicState` and
was reverted same-day. Don't be that module.

`secretState` values must be JSON-serializable; use `null` (never `undefined`)
inside them — updates cross JSON store boundaries where `undefined` vanishes.

## 3. Lifecycle callbacks (all pure — same inputs, same outputs)

```ts
init(ctx)                      // version 0 → first ReduceResult
reduce(ctx, state, action)     // validate + apply an intent, or ReduceError
onTick?(ctx, state)            // active timer expired; null = no-op
onSeatAbandoned?(ctx, state, seat)  // seat left past grace; null = no-op
onSeatReplaced?(ctx, state, seat)   // abandoned seat reclaimed; null = no-op
awaitedSeats(ctx, state)       // seats whose input the game waits on NOW
suggestBotAction?(ctx, state, seat) // legal move for an abandoned awaited seat
```

- Never mutate `state` — return fresh objects.
- Never throw for invalid input — return `{ error, code }` (snake_case code);
  the platform relays it to the acting client only.
- No I/O, no `Date.now()`, no `Math.random()` — use `ctx.now` and `ctx.rng`.
  `ctx.rng` is seeded from `(matchSeed, version)`: deterministic, replayable,
  and unpredictable to clients (they never see the seed).
- Every applied result bumps `version` by exactly 1 (optimistic CAS under the
  hood — a conflicting write simply retries at the service layer).

## 4. ReduceResult field reference

| Field | Semantics |
| :--- | :--- |
| `publicState` | required; full replacement |
| `privateState` | per-seat full replacement; omitted seats keep theirs |
| `secretState` | omit = keep; present (incl. `null`) = replace |
| `phase` | required; free-form except the final phase must be `"game_over"` |
| `scores` | **cumulative totals** per seat (not deltas); omitted seats keep theirs; carry your own running totals in state (`_totals` pattern) — reduce never receives prior scores |
| `timer` | `{ endsAt: ctx.now + ms, kind, durationMs }` starts; `null` clears; omit keeps. Expiry calls `onTick` (late ticks are normal — never rely on exact firing) |
| `events` | broadcast to all clients + audit log; small payloads; drive one-shot Stage/Controller animations |
| `matchOver` | set `true` exactly once, together with `phase: "game_over"`; platform finalizes and shows the podium from `scores` |

**Timers must always make progress**: every timed phase needs an `onTick` that
advances the game (auto-submit, auto-pass, resolve-with-what-you-have), or the
match can stall. If a due timer returns `null`, the platform drops the timer.

## 5. Abandonment & bots

`ctx.seats[i].abandoned === true` → the player left past the reconnect grace.

- **Group inputs** (votes, ready-checks, simultaneous submissions): treat
  abandoned seats as *not expected* — exclude them from completion checks AND
  from `awaitedSeats`.
- **Mandatory single-actor steps** (current officeholder must discard, clue
  giver must submit): keep the seat in `awaitedSeats` even when abandoned; the
  platform then calls `suggestBotAction` for it and applies the returned action
  through `reduce` — bots can never cheat because they go through validation.
- Implement `onSeatAbandoned` to re-check group completions so a leaver can't
  freeze a phase that was one input away from done.

## 6. Settings, lobby options & content packs

- `meta.defaultSettings` + `meta.settingFields` drive the host's house-rules UI.
  Field types: `boolean`, `number` (min/max/step), `select` (options), `pack`.
- Effective settings arrive on `ctx.settings` (defaults overlaid with host
  choices). Read defensively (typeof checks) — a `getSettings(ctx)` helper per
  game is the established pattern.
- A `pack`-type setting is resolved by the server: the full `ContentPack` is
  injected at `ctx.settings._pack` before any callback runs. Ship built-in
  packs via the module's `packs` array; mark spicy ones `nsfw: true`.
- Optional `ui.LobbyOptions` renders a custom settings panel in the lobby
  (`LobbyOptionsProps`: `settings`, `onChange(patch)`, `disabled`, `t`).

## 7. i18n

All player-visible strings go through `t(key)` with keys `games.<id>.*`
declared in the module's `i18n.en` map — zero hardcoded strings in JSX.
Interpolation: `t("games.x.hello", { name })` fills `{name}`.
Registry CI (`packages/games/src/__tests__/registry.spec.ts`) asserts:
unique meta ids matching registry keys, player bounds within the platform cap
(≤8), `nameKey`/`descriptionKey` resolve, every settingField `labelKey` (and
select option labelKey) resolves, and the required plugin surface exists.

## 8. UI slots

- `ui.Stage` (`StageProps`: `room`, `match`, `t`, `now`) — the TV. Read-only.
  Huge type (10-ft test), playful animated moments, neo-brutalist per
  DESIGN.md. The shell already renders the header (game name, room code,
  timer bar) and footer scoreboard — never render your own global timer bar
  or scoreboard.
- `ui.Controller` (`ControllerProps`: + `seat`, `privateState`, `act`) — the
  phone. Min 44px touch targets, works at 360px, no hover-only affordances.
  `act(type, payload)` resolves `{ok:false, code, error}` on rejection —
  surface it inline near the control, never `alert()`.
- `now` prop is a server-adjusted ticking clock (~2Hz) for countdown display.
- Accessibility: `aria-live="polite"` region announcing phase changes on both
  views; accessible names on every interactive element; never convey state by
  color alone.
- Render something sane for **every** phase, with defensive null checks —
  clients can reconnect into any phase.

## 9. Testing harness (`@merky/game-sdk/testing`)

Mirrors server semantics exactly (version bumps, rng derivation, per-seat
private merge, cumulative scores, timer keep/clear, secretState keep/replace).

```ts
import { createTestMatch, act, actErr, fireTimer, abandonSeat, botStep } from "@merky/game-sdk/testing";

const m = createTestMatch(mygame, { players: 5, seed: "golden-1" });
act(m, 0, "nominate", { seat: 2 });      // throws if the game rejects
actErr(m, 1, "nominate", { seat: 3 });   // throws if the game accepts
fireTimer(m);                            // jump to deadline, run onTick
abandonSeat(m, 2); botStep(m);           // abandonment + bot coverage
m.state.phase; m.scores; m.log;          // assertions
m.state.privateState[0];                 // one seat's slice
m.state.secretState;                     // server-only slot (test-only access)
```

A strong suite covers: a full golden path to `game_over`, every action's
rejection paths, timer expiry for every timed phase, abandonment/bot coverage,
determinism (same seed twice → identical transcripts), and **security
invariants** — `JSON.stringify(publicState)` and each individual seat's
private slice must never contain hidden information.

## 10. DOs and DON'Ts

**DO**
- Keep reducers total: every `(state, action)` either applies or returns a
  typed error.
- Route timeout auto-actions through the same helpers as player actions.
- Carry running score totals in state; emit cumulative `scores`.
- Use `ctx.rng` for every random choice, including bot suggestions.
- Test the strongest invariant you can state (conservation laws, phase
  reachability, no-leak stringify checks).

**DON'T**
- Put hidden info in `publicState` (see §2) — the #1 historical failure.
- Use `Math.random()`, `Date.now()`, `setTimeout`, `fetch`, or module-level
  mutable state in game logic.
- Mutate the incoming `state`/`ctx`.
- Throw from `reduce` for invalid intents.
- Render your own global timer bar/scoreboard, or hardcode UI strings.
- Add dependencies, edit other games, the SDK, `packages/ui`, or the web shell
  from inside a game task.
- Rely on exact timer firing times or event delivery order for correctness.

---

## 11. Changing the SDK itself

The SDK is shared infrastructure: every game, the server runtime, three store
adapters, the PartyKit edge worker, and the test harness compile against it.
Change it rarely, deliberately, and completely.

### When an extension is justified
1. The capability **cannot be built inside a game** against the existing
   contract (e.g. server-only secrets — there was no sanctioned slot, so
   `secretState` was added).
2. It benefits **all games going forward**, not one game's convenience.
3. It preserves every existing game unchanged (additive only).

If a need is game-specific, build it in the game. If it's shell polish, build
it in `apps/web` or `packages/ui`. The SDK is only for contract-level gaps.

### What must never change
- **Broadcast semantics**: `publicState` to everyone; per-seat `privateState`
  slices; `secretState` to no client. Nothing may widen visibility.
- **Purity + determinism**: callbacks stay pure; rng stays seeded from
  `(matchSeed, version)`; version bumps by exactly 1 per applied result.
- **Existing field semantics** (full-replacement rules, cumulative scores,
  timer keep/clear, omit-keeps conventions) — games are written against them.
- **`game_over` / `matchOver` finalization contract.**

### Backward-compatibility requirements
- New fields on `GameStateIn`/`ReduceResult`/records are **optional** with
  "omitted = previous behavior" semantics.
- Values crossing store boundaries must survive JSON round-trips (design
  "keep vs replace" so dropped-`undefined` keys mean "keep").
- Existing games must pass their suites **without edits**.

### Every surface that must change in lockstep
An SDK state/lifecycle change is not done until ALL of these are updated:

| Surface | File |
| :--- | :--- |
| Types (source of truth) | `packages/game-sdk/src/types.ts` |
| Test harness (mirrors server exactly) | `packages/game-sdk/src/testing.ts` |
| Runtime: update builder + every `GameStateIn` construction site (onTick, awaitedSeats, bot reduce, seat hooks, player action) + init path | `apps/web/src/server/runtime.ts` |
| Record/update types | `apps/web/src/server/store/types.ts` |
| Memory store apply | `apps/web/src/server/store/memory.ts` |
| Upstash store apply | `apps/web/src/server/store/upstash.ts` |
| PartyKit edge store apply | `packages/party/src/server.ts` |
| Client views — confirm the new data does **not** leak (matchView / buildSnapshot / published messages) | `apps/web/src/server/views.ts` |

### Test gates (all must pass before an SDK change ships)
1. A dedicated platform spec proving the new contract end-to-end through the
   real service→runtime→store pipeline, **including a no-leak test** that
   stringifies every client-bound surface (see
   `apps/web/src/server/__tests__/secret-state.spec.ts` as the model).
2. `pnpm --filter @merky/web test` — platform suite green.
3. `pnpm --filter @merky/games test` — every game suite green, unmodified.
4. `pnpm -r typecheck` — clean (strict + `noUncheckedIndexedAccess`).
5. Update this README (§2/§4/§9 tables + this section) and CONTRACTS.md in the
   same change.
