# AGENTS.md — Working in The Merkive

Read these before touching code; they are binding, in this order:

1. **[packages/game-sdk/README.md](packages/game-sdk/README.md)** — the Game
   SDK guide. Everything about building a game plugin: the three state slots
   (`publicState` broadcast to everyone / per-seat `privateState` / server-only
   `secretState`) and who sees what, lifecycle callbacks and purity rules,
   determinism (`ctx.rng`/`ctx.now` only), timers, bots & abandonment,
   settings/content packs, i18n, Stage/Controller UI contracts, the test
   harness, dos & don'ts — **plus the policy for changing the SDK itself**
   (when an extension is justified, what must never change, every surface that
   must be updated in lockstep, and the test gates).
2. **[CONTRACTS.md](CONTRACTS.md)** — platform engineering contracts: server
   authority, versioning CAS, room lifecycle, ownership zones.
3. **[DESIGN.md](DESIGN.md)** — the neo-brutalist design system: tokens,
   typography, borders/slab shadows, motion/FX kit, responsive + a11y
   standards.
4. **[CONTRIBUTING.md](CONTRIBUTING.md)** — contribution guidelines: ownership
   zones, coding standards, commit conventions, PR process, and the new-game
   checklist.

## Golden rules

- The platform spine (`apps/web` service/runtime/routes, `packages/party`,
  `packages/ui`, the SDK) is stable infrastructure. Game work happens inside
  `packages/games/src/<id>/` only; registry wiring is one import + one entry
  in `packages/games/src/index.ts` + a `GameIcon` case in
  `packages/ui/src/icons.tsx`.
- **Never put hidden information in `publicState`** — it is broadcast verbatim
  to every client. Seat-scoped secrets → that seat's `privateState`; global
  secrets (decks, hidden targets) → `secretState`. A game was once reverted
  for leaking roles through `publicState`.
- Game logic is pure and deterministic: no `Math.random()`, no `Date.now()`,
  no I/O, no mutation of incoming state. Reject invalid intents with
  `{ error, code }` (snake_case), never throw.
- SDK changes are rare and policy-gated — follow §11 of the SDK guide
  (additive-only, every listed surface updated in lockstep, platform + game
  suites green, docs updated in the same change).
- All UI strings via `t("games.<id>.*")`; neo-brutalist tokens/components from
  `@merky/ui`; Stage readable at 10 ft; Controller works at 360px with ≥44px
  targets; `aria-live` phase announcements.

## Commands

```bash
pnpm --filter @merky/games test     # game suites
pnpm --filter @merky/web test       # platform suite (must stay green)
pnpm -r typecheck                   # strict, noUncheckedIndexedAccess
```

Done = your tests + the registry suite + platform suite green, typecheck
clean. Knowledge/market research lives in `market-research/` (see
[index.md](market-research/index.md)).
