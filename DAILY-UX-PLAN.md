# Daily Games UX Plan — grounding + fixes

> **Status: all seven phases shipped** on `feat/daily-ux-pass` (2026-07-25), one
> commit per phase, not yet pushed. Gates green at each step: `@merky/games`
> 217 tests, `@merky/web` 126, `pnpm -r typecheck` clean, and no horizontal
> overflow on /daily or any of the three games at 320 / 390 / 768 / 1280.
>
> Two findings that changed the plan as written:
> - `ui.HowToPlay` **already existed** on `DailyGameModule` and had never been
>   implemented, so Workstream D needed no contract change.
> - Nexus's `solved` check (`score === 9`) would have marked a perfect-but-
>   retried grid as *failed* once scoring went fractional. Caught in E4.

Compiled from the 2026-07-25 playtest feedback (two screenshots + notes).
Every item below is traced to the code that causes it. Ordered by workstream,
not by the order the feedback arrived.

**Note:** the third attachment (`IMG_0973.heic`, a Messages attachment) could
not be read — the Messages attachment directory is TCC-protected and `sips`
fails on it. If it shows something not covered below, re-send it from a
readable path.

---

## Workstream A — Responsive scaling, text & button wrapping

> "Submit button looks wonky… people may be on mobile, tablets, or computers.
> We need proper UI scaling and addressing text and button wrapping properly —
> this example for submit and the categories for the grid. Properly handle all
> stuff like this across all daily games."

### A1. Nexus submit button overflows its row (the screenshot)

**Where:** [`packages/games/src/daily/nexus/ui.tsx:234-258`](packages/games/src/daily/nexus/ui.tsx#L234)

The answer row is `<form className="flex gap-2">` with `input flex-1` and a
`<Button className="min-h-[44px] px-4">`. `Button` is
`inline-flex … whitespace-normal by default` but has no `shrink-0`
([`packages/ui/src/Button.tsx:61-72`](packages/ui/src/Button.tsx#L61)), so on a
390px viewport the flex row gives the input its `flex-1` share and squeezes the
button below its intrinsic width. "SUBMIT ANSWER" then wraps to two lines and
paints outside the button's own box — exactly the clipped `UBMI/NSWE` in the
screenshot.

**Fix:** stack the form at narrow widths (`flex-col sm:flex-row`), give the
button `shrink-0 whitespace-nowrap` and `block sm:w-auto`, and shorten the label
(`daily.nexus.submitGuess` → "Submit") for the narrow case.

### A2. Nexus grid category / question cells clip

**Where:** [`packages/games/src/daily/nexus/ui.tsx:123-190`](packages/games/src/daily/nexus/ui.tsx#L123)

Row and column headers are `text-[10px] sm:text-xs … line-clamp-2` in a rigid
`grid-cols-4` with a `min-h-[36px]` / `min-h-[50px]` floor. "SUPERLATIVES" only
fits because it's clamped; question text in cells is `line-clamp-2` and cuts
mid-word ("Which element i…"). There is no growth path at tablet/desktop — the
grid stays `max-w-md` at every breakpoint
([line 95](packages/games/src/daily/nexus/ui.tsx#L95)).

**Fix:**
- Widen the shell responsively: `max-w-md sm:max-w-xl lg:max-w-3xl`, and let
  cell/label type scale with it (`text-[11px] sm:text-sm lg:text-base`).
- Replace fixed `min-h-*` with `aspect-square`/`min-h-` + `items-center` so
  cells grow with the container instead of clamping harder.
- Give clamped labels a `title` attribute so the full text is recoverable, and
  keep `hyphens-auto break-words` on questions so the clamp lands at a word
  boundary.

### A2b. Hub header button wraps mid-phrase

**Where:** [`DailyHomeScreen.tsx:50-52`](apps/web/src/components/daily/DailyHomeScreen.tsx#L50)

The hub screenshot shows **BACK TO / HOME** breaking across two lines while the
title beside it wraps to three. The header is a `flex justify-between gap-4`
with an `h1` at `text-4xl sm:text-5xl` and no `min-w-0`, so the title claims the
row and the button is compressed below its label width. Same class of bug as A1,
different screen — which is the argument for fixing A3 before either.

**Fix:** `min-w-0` on the title block, `shrink-0 whitespace-nowrap` on the
button, and shorten to "Home" below `sm`.

### A3. Root cause: no shared responsive contract

`DESIGN.md` documents tokens, borders and motion but has **no** breakpoint or
text-wrapping standard (grep for `truncate|clamp|responsive` returns one
unrelated hit). Each daily game hard-codes `max-w-md mx-auto`:

- [`nexus/ui.tsx:95`](packages/games/src/daily/nexus/ui.tsx#L95)
- [`nutshell/ui.tsx:276`](packages/games/src/daily/nutshell/ui.tsx#L276)
- [`relay/Play.tsx:80`](packages/games/src/daily/relay/Play.tsx#L80)

…and the shell wraps them in another `max-w-2xl`
([`DailyPlayShell.tsx:141`](apps/web/src/components/daily/DailyPlayShell.tsx#L141)),
so a desktop player gets a phone-width column with phone-sized type.

**Fix (do this first — A1/A2 ride on it):**
1. Add a **Responsive & wrapping** section to `DESIGN.md`: the three target
   classes (phone ≤480, tablet 481–1024, desktop >1024), the rule that no
   interactive label may clip or overflow, minimum 44px targets, and the
   "labels shrink, never overflow" pattern (`min-w-0` + `shrink-0` pairing).
2. Add a `DailyBoard` layout primitive in `packages/ui` (or
   `apps/web/src/components/daily/`) that owns the responsive max-width and
   type scale, and have all three games render inside it instead of their own
   `max-w-md`.
3. Sweep Nutshell's fixed `w-12 h-12 sm:w-14 sm:h-14` cells
   ([`nutshell/ui.tsx:356,374`](packages/games/src/daily/nutshell/ui.tsx#L356))
   and its `min-w-[30px]` keyboard keys
   ([line 457](packages/games/src/daily/nutshell/ui.tsx#L457)) onto the same
   scale — a 5×5 of 48px cells is cramped on a 1440px monitor and tight at
   320px.
4. Sweep Relay's chain chips and word bank
   ([`relay/Play.tsx:116-188`](packages/games/src/daily/relay/Play.tsx#L116)) —
   `grid-cols-2 sm:grid-cols-3` never widens past `sm`.

**Verification:** load each game at 320 / 390 / 768 / 1280 in the browser pane
and confirm no horizontal body scroll and no clipped label.

---

## Workstream B — Ticker only on lobby screens

> "The scrolling bottom banner shouldn't show when in games, only on lobby
> screens… only on daily games list/lobby."

**Where:** [`apps/web/src/components/daily/DailyPlayShell.tsx:198`](apps/web/src/components/daily/DailyPlayShell.tsx#L198)

The Ticker is `fixed bottom-0 z-40` on the *play* shell. This is the only place
it appears mid-game — multiplayer already does the right thing: `StageApp`
renders it in `StageLobby` only
([`StageApp.tsx:167`](apps/web/src/components/StageApp.tsx#L167)), never in the
in-game `Stage` branch.

**Fix:**
- Delete the `<Ticker>` and its `useDailyTickerItems` call from
  `DailyPlayShell` (also drops a per-500ms re-render source).
- Keep it on [`DailyHomeScreen.tsx:107`](apps/web/src/components/daily/DailyHomeScreen.tsx#L107)
  and `HomeScreen`.
- Drop the now-dead `pb-24` bottom padding on the play shell
  ([line 141](apps/web/src/components/daily/DailyPlayShell.tsx#L141)).
- If the completion-state ticker news is worth keeping, surface it inside the
  `ShareCard` block instead, not as a fixed strip.

**Test:** add a `@merky/web` case asserting the play shell renders no marquee
and the hub does.

---

## Workstream C — Nutshell crossword feel (NYT-mini parity)

### C1. Typing lag — every keystroke is a network round-trip

**Where:** [`nutshell/ui.tsx:158-171`](packages/games/src/daily/nutshell/ui.tsx#L158)
→ [`nutshell/index.ts:199-249`](packages/games/src/daily/nutshell/index.ts#L199)

`handleInputLetter` does `await act("set_cell", …)` and only advances the cursor
*after* the POST to `/api/daily/nutshell/action` resolves. The whole
`publicState` is then replaced from the response
([`DailyPlayShell.tsx:107`](apps/web/src/components/daily/DailyPlayShell.tsx#L107)),
re-rendering the grid. That is one server round-trip per letter — on mobile
data, visibly laggy.

**Fix:** optimistic local grid.
- Hold a local `grid` overlay in the Nutshell component; on keypress, write the
  letter and advance the cursor **synchronously**, then fire `act()` without
  awaiting.
- Reconcile on response; on failure, roll the cell back and show the error.
- Coalesce: keep a per-cell "in-flight" map so a fast typist doesn't get
  out-of-order writes clobbering each other (last-write-wins per cell, keyed by
  a monotonically increasing local sequence number).
- `set_cell` is already idempotent and pure, so no server change is needed.

### C2. Enter should go to the next clue, not flip direction

**Where:** the keydown handler
[`nutshell/ui.tsx:193-233`](packages/games/src/daily/nutshell/ui.tsx#L193)
handles letters, Backspace, Space (toggles direction) and arrows. **`Enter` is
not handled at all** — the user's "when I press enter it goes down" is Space's
toggle behaviour being hit, or the browser default.

**Fix:** match the NYT mini.
- `Enter` / `Tab` → advance to the **next clue in the current direction**
  (wrapping from the last across clue to the first down clue), landing on its
  first empty cell.
- `Shift+Tab` → previous clue.
- Keep `Space` as the across/down toggle (that part is already right).
- Auto-advance to the next clue when the current word is filled.

### C3. Typing should skip letters already filled from a crossing

> "If we're working across and we hit a column where down is complete, it should
> go to the box after that column. If we had MARK down and WASP across
> connecting on A — if I type W it should jump past the A so I can just type
> S, P."

**Where:** `advanceCursor` [`nutshell/ui.tsx:128-144`](packages/games/src/daily/nutshell/ui.tsx#L128)
moves exactly one cell, unconditionally.

**Fix:** after typing a letter, advance to the next **empty** cell in the active
slot, skipping over any run of already-filled cells — not just one. Worked
against the example: cursor at W, type `W` → skip the filled `A` → land on
position 3; type `S` → land on 4; type `P` → word complete.

Rules to get right:
- Skip a **run**, not a single cell — `WA_K` with two crossings filled must jump
  both.
- If every remaining cell in the slot is filled, park on the slot's **last**
  cell rather than jumping to another word (then C2's auto-advance takes over).
- A direct **click** still addresses any cell, filled or not — that's how you
  deliberately overwrite.
- **Backspace** retreats over filled cells one at a time; it must *not* skip,
  since skipping would make it impossible to delete a crossing letter.
- Revealed cells (C4) are skipped by typing and refused by overwrite.

Worth a unit test on the cursor helper with the MARK/WASP fixture — this is
pure index math and easy to lock down.

### C4. (Related) revealed cells should be write-protected

Once `reveal_cell` sets a letter, typing over it currently just overwrites it.
Worth locking, or at least visually distinguishing it, while C3 is in flight.

---

## Workstream D — How to play (all games)

> "There is no instructions… show how to play as a modal when people first
> launch it, but give them a button in-game to describe how to play. Show text
> and diagrams where needed. For all games."

**Current state:** nothing exists. `DailyGameModule`
([`packages/games/src/daily/types.ts`](packages/games/src/daily/types.ts)) has
`meta.descriptionKey` and `ui.Play` — no rules surface. The multiplayer
`GameMeta` ([`packages/game-sdk/src/types.ts:35`](packages/game-sdk/src/types.ts#L35))
is the same. `Modal` already exists and is solid
([`packages/ui/src/Modal.tsx`](packages/ui/src/Modal.tsx)) — focus trap, Escape,
scroll, a11y label — so the shell is free.

**Plan:**

1. **Daily contract (do first — not SDK-gated).** Add an optional
   `ui.HowToPlay?: React.ComponentType<{ t: Translate }>` to `DailyGameModule`,
   plus `meta.howToKey` for a one-line summary. Additive and optional, so all
   three games keep compiling. Update
   [`packages/games/src/daily/README.md`](packages/games/src/daily/README.md) in
   the same change.
2. **Seen-flag storage — server-side, against the device.** Confirmed: store it
   the way streaks are stored, keyed to the `daily_devices` row, so it follows
   the recovery code to a new browser and doesn't re-prompt on every device.
   That means a real (small) change through all four store layers:
   - Migration `0002_howto_seen.sql`: add `seen_howto text[] not null default
     '{}'` to `daily_devices`
     ([`0001_daily_games.sql:17`](packages/db/supabase/migrations/0001_daily_games.sql#L17)).
     A `text[]` of game ids beats a `jsonb` prefs blob here — one concern, and
     appending is a one-liner.
   - `DailyDeviceRow` in [`packages/db/src/types.ts`](packages/db/src/types.ts).
   - `DailyStore`: add `markHowToSeen(deviceId, gameId)`, implemented in **both**
     [`store/memory.ts`](apps/web/src/server/daily/store/memory.ts) and
     [`store/supabase.ts`](apps/web/src/server/daily/store/supabase.ts) —
     `store/types.ts` is the interface both must satisfy.
   - Surface `seenHowTo` on the `today`/`[date]` response so the shell knows on
     first paint, and a `POST /api/daily/howto-seen` to set it.

   *Cost check:* this is ~4 files plus a migration versus one `localStorage`
   line. It's the right call for a device model with recovery codes, but it is
   the only part of Workstream D that touches the database — if you'd rather
   ship D fast, `localStorage` first and migrate later is a clean fallback,
   since the flag is disposable state.
3. **Shell wiring** in `DailyPlayShell`:
   - A persistent **"How to play"** button in the header next to *Back to hub*.
   - Auto-open the modal on first launch per game, driven by the flag above,
     and mark it seen on close.
   - The modal is `Modal` + the game's `HowToPlay`; add a "Don't show again"
     affordance.
4. **Write the three how-tos**, each with a small inline SVG diagram (all UI
   strings via `t("daily.<id>.howto.*")`):
   - **Nexus** — the row×column intersection idea, one guess per cell (or
     strikes, after Workstream E), reveal cost, 9-cell submit.
   - **Nutshell** — grid + clue list, across/down toggle, check vs. reveal,
     keyboard map (Space / Enter / Tab / arrows) once C2 lands.
   - **Relay** — *this is the one the user got stuck on*: last letter of the
     current word must match the first letter of the next; show a two-step
     worked example diagram.
5. **Multiplayer games (second phase, policy-gated).** The same button belongs
   on the Controller for the six multiplayer games. That means an additive
   `ui.HowToPlay?` on the SDK's `GameModule`, which falls under **§11 of
   [packages/game-sdk/README.md](packages/game-sdk/README.md)** — additive-only,
   every listed surface updated in lockstep, platform + game suites green, docs
   in the same change. Do this as its own PR after the daily version proves out.

---

## Workstream E — Nexus: decaying points, unlimited retries

> "After it's not gotten in 1, it degrades point value. Full point on first
> shot, half on second, .25 on third, after that 0 points. They can keep trying
> if they want, or give up."

**Where:** [`nexus/index.ts:120-146`](packages/games/src/daily/nexus/index.ts#L120)

The one-guess rule is deliberate and documented in-code ("An incorrect guess is
NOT further guessable — one attempt per cell, matching standard trivia-grid
rules"). This replaces it.

**The scoring ladder** — value is fixed by the attempt number on which the cell
is answered correctly:

| Correct on attempt | Points |
| --- | --- |
| 1 | 1.0 |
| 2 | 0.5 |
| 3 | 0.25 |
| 4+ | 0 |

Attempts are **not** capped — a player keeps guessing for pride (and to fill the
grid) after the value floors at 0, or gives up. Max score stays 9.0.

**Changes:**
1. `NexusCellPublic` ([`nexus/types.ts`](packages/games/src/daily/nexus/types.ts)):
   add `attempts: number` and `points: number`. `status` gains `"pending"` —
   *wrong so far, still open* — which is now the state an incorrect guess lands
   in. `"incorrect"` becomes the terminal give-up/submit state.
2. `reduce`/`answer_cell`: on a wrong guess, increment `attempts` and return the
   cell still `unanswered`/`pending` — no lock. On a correct guess, set
   `points = [1, 0.5, 0.25][attempts] ?? 0` and lock `correct`.
3. **Per-cell give up.** Unlimited retries need an explicit "I'm done with this
   one" exit, or `allResolved` never becomes true and the player can't submit.
   Add a `skip_cell` action that locks the cell `incorrect` at 0 points.
   *(Distinct from `reveal_cell`, which shows the answer.)*
4. **Scoring plumbing:** `score` is now fractional. `phase === "solved"` should
   mean **all 9 cells correct**, not `score === 9` — as written
   ([`nexus/index.ts:221`](packages/games/src/daily/nexus/index.ts#L221)) a
   perfect-but-retried grid would read as `failed`. Display as `7.75 / 9`.
   *No schema work needed:* `daily_attempts.score` is already `numeric`
   ([`0001_daily_games.sql:44`](packages/db/supabase/migrations/0001_daily_games.sql#L44))
   and `number | null` in TS, so fractional scores persist as-is.
5. `summarize` ([`nexus/index.ts:238-292`](packages/games/src/daily/nexus/index.ts#L238)):
   encode the ladder in the emoji grid, still spoiler-free —
   🟩 first try · 🟨 second · 🟧 third · ⬛ correct but zero-value · 🟥 gave
   up/unsolved · 👁 revealed. Add a `Attempts: N` line and
   `extra.totalAttempts` to `stats`.
6. UI ([`nexus/ui.tsx:232-272`](packages/games/src/daily/nexus/ui.tsx#L232)):
   keep the input open indefinitely; show **what the next correct answer is
   worth** ("Worth 0.5") rather than strikes remaining — that's the actual
   decision the player is making. Clear `guessText` on a wrong guess (the
   existing `useEffect` at [line 25](packages/games/src/daily/nexus/ui.tsx#L25)
   only clears on selection change) and flash the wrong answer.
7. Update the in-code comment at
   [`nexus/index.ts:127`](packages/games/src/daily/nexus/index.ts#L127) — it
   documents the rule being replaced.
8. Update the Nexus how-to (Workstream D) to show the ladder.

**Watch for:** existing in-flight attempts have `publicState` without
`attempts`/`points`. `reduce` must default them (`?? 0`) rather than assume the
new shape, or today's players break at midnight-adjacent reload.

---

## Workstream F — Daily hub cards: state-aware CTA + descriptions

> "If possible, change 'Play' to 'Results' and have the button a different
> color. Also didn't realize the descriptions on this page — adding them to the
> games too would be good."

**Where:** [`DailyHomeScreen.tsx:98-102`](apps/web/src/components/daily/DailyHomeScreen.tsx#L98)

The hub screenshot makes the bug self-evident: the ticker reads
**"NEXUS: BETTER LUCK TOMORROW"** — the shell already knows Nexus is finished —
while the Nexus card directly above it still says **PLAY**. The ticker gets
device state via `useDailyTickerItems`; the cards never ask for it.

Every card is an unconditional `Play` button. `/api/daily/games` returns
`dailyGameList.map(g => g.meta)`
([`apps/web/src/server/daily/service.ts:47`](apps/web/src/server/daily/service.ts#L47))
— **no per-device today-status**, which is why the card can't know. Note the
card *does* already render `descriptionKey` (line 93); the ask is to carry that
description **into the game**, which is missing everywhere.

**Fix:**
1. Extend the hub's data: either add today's status to `/api/daily/games` or
   have `DailyHomeScreen` also fetch `/api/daily/summary`
   ([`apps/web/src/app/api/daily/summary/route.ts`](apps/web/src/app/api/daily/summary/route.ts)),
   which is already device-scoped. **Prefer the summary fetch** — no API shape
   change, no cache implications on the games list.
2. Card CTA becomes three states:
   - not started → **Play** (`variant="primary"`, violet — current)
   - in progress → **Continue** (`variant="gold"`)
   - solved / failed → **Results** (`variant="secondary"`, green) + a small
     status pill (streak or score).
3. Add the description into the play screen: render `t(meta.descriptionKey)`
   and `taglineKey` under the title in
   [`DailyPlayShell.tsx:142-160`](apps/web/src/components/daily/DailyPlayShell.tsx#L142).
   Each game's own header duplicates the title
   ([nexus:105](packages/games/src/daily/nexus/ui.tsx#L105),
   [nutshell:287](packages/games/src/daily/nutshell/ui.tsx#L287)) — de-dupe
   while you're in there.

---

## Workstream G — Relay polish

### G1. First/last letters invisible on the start and end chips

> "It doesn't have the first letter of the first word or the last letter of the
> last word — I figure that's the background color being the same as the font
> color."

**Confirmed exactly.** [`relay/Play.tsx:128-139`](packages/games/src/daily/relay/Play.tsx#L128):
the start chip is `bg-[var(--mb-accent)]` and its first char is
`text-[var(--mb-accent)]`; the end chip is `bg-[var(--mb-gold)]` and its last
char is `text-[var(--mb-gold)]`. Both render invisible — visible in the
screenshot as `IRCUS` and `NEBUL`.

**Fix:** when the chip is tinted, drop the color emphasis and use
`text-[var(--mb-on-accent)]` / `text-[var(--mb-on-gold)]` with an `underline
decoration-2 underline-offset-2` (or a boxed outline) to keep the
first/last-letter cue without a contrast collision. Same treatment for the word
bank buttons at [line 183](packages/games/src/daily/relay/Play.tsx#L183). Add a
contrast assertion to the Relay test suite so this can't regress.

### G2. Interchangeable bank words (TANGO / TEMPO)

> "Sometimes we get words that don't really change outcome… not sure if that
> matters too much."

**Where:** `validatePack` only checks that *a* chain exists
([`relay/index.ts:97-102`](packages/games/src/daily/relay/index.ts#L97)) via
`findValidChain` ([`relay/solver.ts`](packages/games/src/daily/relay/solver.ts)),
which returns the first path found. Nothing measures how many distinct valid
chains the bank admits, so decoys that share both first and last letters with a
chain word are drop-in substitutes.

**My call (you left this to my discretion): do the cheap version, and don't gate
content on it.**

Reasoning: your instinct that it may not matter much is right. Relay scores on
`movesUsed`, so a second equally-short solution doesn't make the puzzle easier
or the score wrong — TANGO vs. TEMPO is a cosmetic wobble, not a broken puzzle.
What it costs is the *feeling* that the choice meant something, which is worth a
nudge but not a blocker. And a hard `validatePack` rejection is actively
risky: `validatePack` runs on already-queued packs, so tightening it can strand
content that's scheduled to go live.

So:
- Add a **non-blocking warning** in the review path
  (`scripts/daily-content.mjs` / `pnpm daily review`): flag when two bank words
  share the same first letter, last letter, and length, naming the pair, so you
  can swap one while reviewing the draft.
- Leave `validatePack` semantics unchanged.
- Feed it back into `generatePrompt`
  ([`relay/index.ts:50-57`](packages/games/src/daily/relay/index.ts#L50)) — one
  clause asking for decoys that are *not* interchangeable with chain words is
  the cheapest fix of all, since it prevents the case at generation time.

That last bullet is arguably the whole fix; the warning is just the safety net.
Stays last in the sequence — skip it entirely without guilt if something else
needs the time.

---

## Suggested sequencing

| Phase | Contents | Why here |
| --- | --- | --- |
| **1** | B (ticker), G1 (invisible letters) | One-line, zero-risk, immediately visible wins |
| **2** | A3 → A1, A2 (responsive contract + sweeps) | Everything visual sits on top of this |
| **3** | D1–D3 (how-to for daily games) | Highest-value gap; unblocks new players |
| **4** | C1–C4 (Nutshell feel) | Biggest engineering lift; C1 is the perceived-quality win |
| **5** | F (hub CTA + in-game descriptions) | Needs the summary fetch |
| **6** | E (Nexus decaying points) | Spec settled; touches types, reduce, summarize, UI |
| **7** | D4 (SDK how-to for multiplayer) | §11-gated, deserves its own PR |
| **8** | G2 (Relay bank quality) | Nice-to-have content gate |

## Gates for every phase

```bash
pnpm --filter @merky/games test && pnpm --filter @merky/web test && pnpm -r typecheck
```

Plus, per CLAUDE.md: registry suite green, all new strings through
`t("daily.<id>.*")`, `@merky/ui` tokens only, and live browser verification at
320 / 390 / 768 / 1280 before calling any phase done.

## Decisions taken (2026-07-25)

All four open calls are now closed:

1. **Nexus** — decaying points (1 / 0.5 / 0.25 / 0), **no attempt cap**, player
   may keep trying or give up. → Workstream E, rewritten.
2. **Nexus scoring** — partial credit; score is fractional out of 9. Free on the
   storage side (`score` is already `numeric`). `solved` must be redefined as
   "all 9 correct" rather than `score === 9`.
3. **How-to seen flag** — server-side against the device row, like streaks.
   → Workstream D2, with the migration and store work spelled out.
4. **Relay decoys** — left to my discretion; I chose prompt-level prevention
   plus a non-blocking review warning, and no `validatePack` change.
   → Workstream G2.

## Still worth a second look during implementation

- **Nexus needs a per-cell exit.** Unlimited retries mean `allResolved` never
  goes true unless the player can bail on a cell — hence the proposed
  `skip_cell` action (E3). If you'd rather the existing *Reveal* button serve as
  that exit, say so and E3 drops out.
- **Migration ordering.** D2 is the only DB change in the whole plan; it can
  ship independently of everything else in Workstream D.
