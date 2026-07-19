# The Merkive

Browser party games for 2–8 friends: one shared **Stage** (TV/laptop), everyone else plays on their phone as a **Controller**. Rooms are 4-letter codes; games are modular plugins.

**Launch Games**

| Game | Players | One-Liner |
| :--- | :--- | :--- |
| **Zaplash** | 3–8 | Write outrageous answers to prompts, vote for the best, ZAP bonus for clean sweeps |
| **Eightstorm** | 2–8 | Crazy-8s shedding — match rank or suit, eights are wild, house rules for stacks/skips/reverses |
| **Tile Tangle** | 2–8 | Rummikub-style sets & runs with full table rearrangement and a 30-point opening meld |

---

## ⚡ Quickstart (Local Development)

```bash
# 1. Install dependencies
pnpm install

# 2. Run local dev server (Next.js web shell + PartyKit edge relay)
pnpm dev
```

- Open `http://localhost:3000` on your phone/browser to create or join a room.
- Open `http://localhost:3000/stage/CODE` on a big screen or TV to view the shared lobby and stage display.
- To add local players in one browser tab, click **"+ Add a local player"** in the lobby or visit `/play/CODE?new=1`.

---

## ⚙️ Project Architecture

```
apps/web/            Next.js 15 App Router (Stage & Controller shell, API routes)
packages/party/      PartyKit Edge Room Engine (In-memory Durable Objects & WebSockets)
packages/game-sdk/   Core plugin contract: GameModule, deterministic RNG, test harness
packages/games/      Game plugins (Zaplash, Eightstorm, Tile Tangle) + central registry
packages/ui/         Neo-Brutalist Design System (@merky/ui tokens & components)
CONTRACTS.md         State semantics, versioning CAS, private-state contracts
DESIGN.md            Visual design specification (color tokens, typography, motion)
```

### Server-Authoritative Realtime Engine
- **Server-authoritative**: Controllers POST intents to `/api/rooms/[code]/action`; Vercel executes the game's pure `reduce` function and updates room state. Private card hands and prompts never reach unauthorized clients.
- **PartyKit Edge Engine**: In production on Vercel, state broadcasts and WebSockets run on Cloudflare's Edge via PartyKit (`packages/party`). This eliminates database latency and delivers sub-30ms real-time patches to Stage & Phone devices. Zero Supabase or SQL configuration required.
- **Deterministic state**: Each `reduce` call receives a seed derived from `(match seed, state version)`. Matches are 100% replayable from event logs.

---

## 🛠️ Onboarding: Adding a New Game

Games are 100% self-contained plugins in `packages/games/src/`. Adding a new game requires **zero changes to the web shell or API routes**:

1. **Create game directory**: `packages/games/src/<game_id>/`
   - `index.tsx`: Export a `GameModule` using `defineGame(...)`.
   - `logic.ts`: Pure `init(ctx)` and `reduce(ctx, state, action)` functions.
   - `Stage.tsx`: TV display component (`StageProps`).
   - `Controller.tsx`: Mobile phone controller component (`ControllerProps`).
   - `__tests__/<game_id>.spec.ts`: Unit tests using `@merky/game-sdk/testing`.
2. **Register the game**: Add 1 line to `packages/games/src/index.ts`:
   ```ts
   import { mygame } from "./mygame";
   export const gameList = [zaplash, eightstorm, tiletangle, mygame];
   ```
3. **Run tests**:
   ```bash
   pnpm test
   ```
   *The built-in registry test suite automatically enforces unique IDs, player bounds, i18n keys, and UI exports.*

Refer to [CONTRACTS.md](CONTRACTS.md) for state contracts and [DESIGN.md](DESIGN.md) for styling guidelines.

---

## 🚀 Deploying to Production (PartyKit + Vercel)

### 1. Deploy the PartyKit Edge Relay (~1 min)
```bash
cd packages/party
npx partykit deploy
```
*Note your deployed PartyKit host (e.g. `the-merkive-party.username.partykit.dev`).*

### 2. Deploy to Vercel
Add the following Environment Variables in your Vercel Project Settings:

| Environment Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_MB_MODE` | Transport mode | `partykit` |
| `NEXT_PUBLIC_PARTYKIT_HOST` | Client WebSockets domain | `the-merkive-party.username.partykit.dev` |
| `PARTYKIT_HOST` | Vercel API REST POST domain | `the-merkive-party.username.partykit.dev` |

Deploy using Vercel CLI or GitHub integration:
```bash
npx vercel --prod
```

---

## 🧪 Commands

```bash
pnpm dev          # Run web app & PartyKit dev servers
pnpm test         # Run unit & integration tests across all packages
pnpm typecheck    # Strict TypeScript verification across all packages
pnpm build        # Production build
```
