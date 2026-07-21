# Contributing to The Merkive

Thank you for your interest in contributing to The Merkive! This guide will help you get set up and understand how the project works so you can start building.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Building a New Game Plugin](#building-a-new-game-plugin)
  - [Improving Existing Games](#improving-existing-games)
  - [UI & Design System Contributions](#ui--design-system-contributions)
  - [Documentation](#documentation)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Architecture & Key Concepts](#architecture--key-concepts)
- [License](#license)

---

## Code of Conduct

This project follows a standard of respectful, inclusive collaboration. Be kind, be constructive, and assume good intentions. Harassment, discrimination, and disruptive behavior will not be tolerated.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 10

```bash
# Enable corepack (ships with Node.js)
corepack enable && corepack prepare pnpm@latest --activate

# Clone and install
git clone https://github.com/Mster115/the-merkive.git
cd the-merkive
pnpm install

# Start the dev server
pnpm dev
```

Verify everything works:

```bash
pnpm test        # All tests should pass
pnpm typecheck   # No TypeScript errors
```

---

## Project Structure

```
apps/web/                 → Next.js 15 App Router (Stage & Controller shell, API routes)
packages/game-sdk/        → Core plugin contract, deterministic RNG, test harness
packages/games/           → Game plugins + central registry
packages/party/           → PartyKit Edge Room Engine (WebSockets & Durable Objects)
packages/ui/              → Neo-Brutalist Design System (@merky/ui)
market-research/          → Competitive analysis & game design research
CONTRACTS.md              → Platform state semantics & engineering contracts
DESIGN.md                 → Visual design specification
```

### Ownership Zones

| Zone | Who Can Modify | Notes |
| :--- | :--- | :--- |
| `packages/games/src/<id>/` | Game authors | Your game plugin lives here |
| `packages/games/src/index.ts` | Maintainers only | Game registry — request wiring via PR |
| `packages/game-sdk/` | Maintainers only | Plugin contract — changes are rare and policy-gated |
| `packages/ui/` | Maintainers only | Design system components & tokens |
| `packages/party/` | Maintainers only | Edge runtime engine |
| `apps/web/` | Maintainers only | Platform shell, API routes, service layer |

> **Rule of thumb**: If you're building a game, you should only need to touch files inside `packages/games/src/<your_game_id>/`.

---

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/Mster115/the-merkive/issues) to avoid duplicates
2. Open a new issue with:
   - **Title**: Clear, concise summary
   - **Environment**: Browser, OS, device type (phone/desktop)
   - **Steps to reproduce**: Numbered list
   - **Expected vs. actual behavior**
   - **Screenshots or screen recordings** if applicable
   - **Room code & game** if the bug occurred during gameplay

### Suggesting Features

Open an issue with the `enhancement` label. Include:
- **Problem statement**: What pain point does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What else did you think about?
- **Scope**: Is this a game plugin, platform feature, or design system change?

### Building a New Game Plugin

This is the most common contribution! Games are self-contained plugins that require **zero changes** to the web shell or API routes.

**Before you start**, read these documents in order:

1. **[Game SDK Guide](packages/game-sdk/README.md)** — the complete plugin contract
2. **[CONTRACTS.md](CONTRACTS.md)** — platform state semantics
3. **[DESIGN.md](DESIGN.md)** — visual design system

**File structure for a new game:**

```
packages/games/src/<game_id>/
├── index.tsx              # GameModule export via defineGame(...)
├── logic.ts               # Pure init() and reduce() functions
├── Stage.tsx              # TV display component (StageProps)
├── Controller.tsx         # Phone controller component (ControllerProps)
└── __tests__/
    └── <game_id>.spec.ts  # Unit tests using @merky/game-sdk/testing
```

**Checklist before submitting:**

- [ ] `pnpm test` passes (including the registry test suite)
- [ ] `pnpm typecheck` is clean
- [ ] All strings use `t("games.<id>.*")` — no hardcoded English
- [ ] Game logic is pure: no `Math.random()`, `Date.now()`, or I/O
- [ ] `publicState` contains **no hidden information** (use `privateState` or `secretState`)
- [ ] Stage is readable at 10 ft distance
- [ ] Controller works at 360px width with ≥44px touch targets
- [ ] `prefers-reduced-motion` is respected (no motion-critical UX)

### Improving Existing Games

- Bug fixes, balance tweaks, and UX improvements to existing games are welcome
- Stay within that game's directory (`packages/games/src/<id>/`)
- Don't change the game's `meta.id`, min/max players, or i18n key prefixes without discussion
- Add or update tests for any logic changes

### UI & Design System Contributions

Changes to `packages/ui/` affect every game and the platform shell. These require maintainer review and should be discussed in an issue first. Follow the [DESIGN.md](DESIGN.md) specification — the neo-brutalist aesthetic is intentional and consistent.

### Documentation

Documentation improvements are always welcome:
- Fix typos, clarify instructions, add examples
- No issue required — just open a PR

---

## Development Workflow

```bash
# Start dev server
pnpm dev

# Run all tests
pnpm test

# Run game tests only
pnpm --filter @merky/games test

# Run platform tests only
pnpm --filter @merky/web test

# Type check everything
pnpm typecheck

# Production build
pnpm build
```

### Testing Your Game

Use the test harness from `@merky/game-sdk/testing`:

```ts
import { createTestMatch, act, actErr, fireTimer, abandonSeat, botStep } from "@merky/game-sdk/testing";

const m = createTestMatch(mygame, { players: 4, seed: "test-1" });

// Player 0 submits an action
act(m, 0, "submit_answer", { text: "hello" });

// Expect player 1's action to be rejected
actErr(m, 1, "invalid_action", {});

// Simulate timer expiry
fireTimer(m);

// Test bot coverage for abandoned seats
abandonSeat(m, 2);
botStep(m);

// Assert on state
expect(m.state.phase).toBe("voting");
expect(m.scores[0]).toBe(100);
```

---

## Coding Standards

### TypeScript

- **Strict mode** is enabled with `noUncheckedIndexedAccess` — handle `undefined` on every indexed access
- No `any` types — use proper generics or `unknown`
- Prefer `const` over `let`; never use `var`

### Game Logic Purity

Game `reduce` and `init` functions must be **pure**:

| ✅ Do | ❌ Don't |
| :--- | :--- |
| Use `ctx.rng` for randomness | Use `Math.random()` |
| Use `ctx.now` for timestamps | Use `Date.now()` |
| Return fresh state objects | Mutate the incoming `state` |
| Return `{ error, code }` on bad input | Throw exceptions |
| Use `snake_case` for error codes | Use camelCase error codes |

### State Slot Rules

| Slot | Visibility | Use For |
| :--- | :--- | :--- |
| `publicState` | All clients | Phase, scores, board state — anything everyone can see |
| `privateState` | Per-seat (only that player) | Card hands, secret prompts, hidden answers |
| `secretState` | Server only (never sent) | Decks, hidden targets, answer keys |

### UI Guidelines

- Use components from `@merky/ui` (`Button`, `Card`, `Panel`, `Pill`, `PlayerChip`)
- Use CSS variables from `packages/ui/src/tokens.css` (`--mb-accent`, `--mb-surface`, etc.)
- Follow the neo-brutalist spec in [DESIGN.md](DESIGN.md): hard borders, slab shadows, saturated colors
- Don't render global timer bars or scoreboards — the shell handles those

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

**Types:**

| Type | Usage |
| :--- | :--- |
| `feat` | New feature or game |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style` | Formatting, whitespace (not CSS changes) |
| `chore` | Build, tooling, dependency updates |

**Scopes** (optional): `games`, `sdk`, `web`, `ui`, `party`, `docs`

**Examples:**

```
feat(games): add trivia showdown game plugin
fix(games): handle edge case in Eightstorm skip logic
docs: update contributing guide with test examples
test(games): add bot coverage tests for Tile Tangle
```

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. **Implement** your changes following the guidelines above
3. **Test** everything:
   ```bash
   pnpm test && pnpm typecheck
   ```
4. **Push** your branch and open a Pull Request
5. **Fill out** the PR template:
   - What does this change?
   - Why is it needed?
   - How was it tested?
   - Screenshots (for UI changes)
6. **Address review feedback** — maintainers may request changes
7. **Merge** — a maintainer will merge once approved and CI passes

### PR Checklist

- [ ] Branch is up to date with `main`
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` is clean
- [ ] No unrelated changes included
- [ ] Documentation updated if applicable
- [ ] Commit messages follow conventions

---

## Architecture & Key Concepts

Understanding these concepts will help you contribute effectively:

- **Server-authoritative**: The server runs all game logic. Clients send intents, the server validates and applies them. This prevents cheating.
- **Plugin architecture**: Games implement the `GameModule` interface from `@merky/game-sdk`. The platform discovers and runs them — no shell modifications needed.
- **Deterministic RNG**: Every `reduce` call gets a seeded RNG derived from `(match seed, state version)`. This makes matches fully replayable.
- **Version CAS**: State updates use compare-and-swap on a version counter. Each applied action bumps the version by exactly 1.
- **Bot coverage**: When a player disconnects, the platform calls `suggestBotAction` for their seat. Bot actions go through `reduce` like any other — bots can't cheat.

For the full details, see [CONTRACTS.md](CONTRACTS.md).

---

## License

By contributing to The Merkive, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

---

**Questions?** Open an issue or start a discussion. We're happy to help you get started! 🎲
