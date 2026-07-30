# The daily-content MCP server

[`scripts/mcp/daily-mcp.mjs`](../../scripts/mcp/daily-mcp.mjs) — zero
dependencies, stdio JSON-RPC, ~1,100 lines.

A routine driven by prose has to be told the schemas, the date arithmetic, the
overwrite rules, the no-repeat windows and the secret, and every one of those is
something it can get wrong at 3am with nobody watching. This server turns them
into tool contracts instead. The prompt gets correspondingly shorter, and the
rules stop depending on the model remembering them.

## Setup

Add to your Claude Desktop MCP config:

**1. Store the secret once, in the macOS Keychain.** The command prompts for
the value, so it never enters your shell history:

```bash
security add-generic-password -U -a "$USER" -s merkive-daily-pipeline -w
```

**2. Point Claude Desktop at the server.** Note there is no secret here:

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "merkive-daily": {
      "command": "/Users/marksternefeld/.local/bin/node",
      "args": ["/Users/marksternefeld/merky-box/scripts/mcp/daily-mcp.mjs"],
      "env": { "MERKY_BASE_URL": "https://the-merkive.vercel.app" }
    }
  }
}
```

**Use an absolute path to `node`.** Claude Desktop spawns MCP servers with a
minimal environment, and a version-managed `node` is not on a bare `PATH` — the
symptom is a server that never connects, with `spawn node ENOENT` in the logs.
Prefer a stable symlink over an nvm version directory, which changes on upgrade.
For the same reason the Keychain lookup calls `/usr/bin/security` by absolute
path.

The server reads the word list and pattern library from the repo at the path in
`args`, so the checkout has to stay where it is.

**3. Confirm it resolves**, without printing it:

```bash
pnpm daily secret
```

It reports the length and a hash prefix — enough to tell "I stored the wrong
thing" from "the deployment disagrees" — then makes a real authenticated call
and reports the status code.

> **`-U` is not optional.** Without it, `add-generic-password` refuses when an
> entry already exists and leaves the old value in place. The failure reads like
> a harmless duplicate warning, so a correcting re-run appears to work while the
> wrong secret quietly survives.

### Where the secret lives

One place: the Keychain. [`scripts/secret.mjs`](../../scripts/secret.mjs) reads
it at the moment of use, so no copy sits in the MCP config, in a `.env`, in a
shell history line, in this repo, or in any transcript. Resolution order is
`DAILY_PIPELINE_SECRET` (for CI and containers) → Keychain → `MERKY_SECRET_FILE`
(for Linux hosts with no Keychain).

Tests assert that the value never appears in an error message or a setup hint —
an error that quotes a secret has leaked it into every log that catches it.

## The tools

| Tool | Returns | Why it exists |
| --- | --- | --- |
| `daily_plan` | Per game: queued dates, draft dates, open dates, next targets, an urgency flag | Replaces deriving dates from a count. No puzzle content. |
| `daily_brief` | The game's own authoring brief for a date | Generated from the game's code, so the schema is never stale |
| `daily_history` | Fingerprints, which of your candidate items are already spent, and answers from dates already played | Lets a generator prove its puzzle is new without seeing what it must differ from |
| `daily_grid` | A verified Nutshell interlock, ten words, guaranteed unused — optionally built around a topical `seedWords` answer or a loose `themeWords` vocabulary | Crossword construction is the hardest task in the pipeline; this removes it, and lets the week's culture into the answers without giving up verified construction |
| `daily_check` | `wouldSubmit`, blockers, warnings, and where the pack would land | Dry run against every rule before anything is sent |
| `daily_submit` | Submission result plus item overlaps | Refuses past dates, occupied dates and repeat puzzles; `replaceDraft: true` replaces a draft, never a queued puzzle |

### `replaceDraft` — the one refusal a generator may answer

A draft normally blocks its date, so a pending human decision is never silently
overwritten. That guard also walled generators in: having landed a pack as a
draft, one could not resubmit (the draft blocks the date) and cannot approve
(deliberately not a tool). A pack drafted by mistake — a mistyped
`factCheck.status`, most often — had no move left.

`replaceDraft: true` is the way out, and its blast radius is exactly one draft:

- ✅ Replaces a **draft** on a future date.
- ❌ Never replaces a **queued** puzzle. That blocker is unconditional.
- ❌ Never reaches today or the past.
- ❌ Never bypasses the repeat check — except for the draft it is replacing,
  which must not count as a repeat of itself, or fixing only the status would
  be refused.

Approval remains outside the toolset. `replaceDraft` lets a generator correct
its own mistake; it does not let one decide that unverified content goes live.

## Selective disclosure

Each tool returns the least that lets the next step happen.

- **Never an unplayed answer key.** `daily_history` returns one-way fingerprints
  (SHA-256, truncated) and hashed per-item tokens. A caller can ask "is this
  answer already spent?" and get a yes or no without being handed the answers.
  Items from dates that have already been played come back in the clear — every
  player that day saw them, and a generator needs them to vary its content.
- **Never the secret.** It is read from the process environment at call time and
  never echoed, including in the error paths.
- **Never the queue's contents.** `daily_plan` returns dates and counts only.

This matters because the routine is a language model with a transcript. Anything
a tool returns can end up in a log, a summary, or a screenshot. An answer key
for next Tuesday is exactly the thing that must not.

## Never repeating a puzzle

Enforced in two places, deliberately:

1. **The server.** `submitPack` fingerprints the assembled payload and refuses
   with `409 duplicate_puzzle` if it has been used on any other date. This is the
   guarantee — it holds no matter what submits, including a curl by hand.
2. **The MCP.** `daily_check` and `daily_submit` test the same fingerprint
   before the request is made, so the routine gets a usable error instead of a
   rejection, and `daily_grid` skips any grid whose fingerprint is already
   spent.

The fingerprint is computed from the answer key in canonical form — sorted,
trimmed, lower-cased — so a reshuffled word bank or reordered cells is still
recognised as the same puzzle. Relay fingerprints on the start/end pair alone:
different decoys around the same chain is the same puzzle to a player.

A parity test asserts the two implementations agree. If they ever diverge, one
of them has quietly stopped enforcing the guarantee.

## Nutshell, and why `daily_grid` exists

A 5×5 mini is a dense interlock — the layouts have 0–8 blocked squares, so most
slots cross several others. Constructing one by hand is real crossword work, and
it was the single hardest thing in this pipeline.

`daily_grid` returns ten interlocking words that have never been used. The
routine writes ten clues. That is the whole job.

### Seeds and themes

Two optional inputs put the week's culture into the answers themselves rather
than only the clues (full contract and the editorial bar in
[nutshell.md](nutshell.md)):

- `seedWords` — ranked candidates for one required topical answer. The grid is
  built around the first the everyday fill can surround (`seedUsed`); the rest
  come back in `seedsRejected` with reasons, because letter shape decides what
  fits, not fame. Seeded days always use the live search — a bank built last
  month cannot contain this week — and anchoring the slot prunes the search
  enough that the richer staircase layouts become affordable inside a tool
  call.
- `themeWords` — a loose everyday vocabulary the grid should carry. Delivered
  by anchoring one theme word and rewarding fills that pick up more
  (`themeWordsPlaced`); a bank grid already carrying two or more theme words
  is preferred when one exists.

A seeded grid asserts a real-world fact, so it ships as a draft with a
`sourceRef` for the seed — the word-game fact-check exemption covers only
all-everyday grids.

### Searching is offline; serving is instant

Grid quality and grid cost turn out to be the same axis:

| Pattern | Typical score | Time to fill | Character |
| --- | --- | --- | --- |
| `corners_3x3` | ~13–16 | 20 ms | eight 3-letter words — a vocabulary check |
| `staircase_*` | ~39–42 | ~5 s | two 3s, four 4s, four 5s |
| `tl_br_blocked` | ~49 | ~226 s | four 4s, six 5s |

A tool call cannot spend four minutes, so the two are separated.
[`scripts/build-nutshell-grids.mjs`](../../scripts/build-nutshell-grids.mjs)
searches richest-pattern-first with a time budget and writes
`packages/games/src/daily/nutshell/grids.json`, which is **committed**.
`daily_grid` then scans that bank for the best unused entry and returns
immediately, falling back to a live search only if the bank is exhausted or
missing.

Committing the bank also makes the supply of puzzles an artifact you can read
and review, rather than something each machine regenerates differently.

Rebuild after editing the word list or the patterns, or when the bank runs low:

```bash
node scripts/build-nutshell-grids.mjs 70 --minutes 18
```

### Why grids are scored at all

The solver takes the first fill that fits, and "fits" says nothing about whether
the result is any fun. Left to itself it produced **DUD / IRE / BRA / YEW / DIE
/ URN / ENROL / DERBY / ORE / LAW** — every word legitimate, the grid as a whole
funereal, and deterministic enough to have been the first Nutshell puzzle ever
shipped. `scoreGrid` rewards longer entries and varied initial letters and
penalises vowel-poor stubs; words that only read badly in company were removed
from the curated list outright. Tone is part of the bar for a party game.

## Relationship to the CLI

[`scripts/daily-content.mjs`](../../scripts/daily-content.mjs) (`pnpm daily …`)
is the human's tool and the MCP's shared library — `preflight`, `queueRisk` and
the date helpers are imported from it, so a rule fixed in one place is fixed for
both. Use the CLI to review and approve drafts; the MCP has no approval tool, on
purpose. Deciding what goes live is not the routine's job.
