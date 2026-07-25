# The daily-content MCP server

[`scripts/mcp/daily-mcp.mjs`](../../scripts/mcp/daily-mcp.mjs) — zero
dependencies, stdio JSON-RPC, ~600 lines.

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
security add-generic-password -a "$USER" -s merkive-daily-pipeline -w
```

**2. Point Claude Desktop at the server.** Note there is no secret here:

```json
{
  "mcpServers": {
    "merkive-daily": {
      "command": "node",
      "args": ["/Users/marksternefeld/merky-box/scripts/mcp/daily-mcp.mjs"],
      "env": { "MERKY_BASE_URL": "https://the-merkive.vercel.app" }
    }
  }
}
```

**3. Confirm it resolves**, without printing it:

```bash
pnpm daily secret
```

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
| `daily_grid` | A verified Nutshell interlock, ten words, guaranteed unused | Crossword construction is the hardest task in the pipeline; this removes it |
| `daily_check` | `wouldSubmit`, blockers, warnings, and where the pack would land | Dry run against every rule before anything is sent |
| `daily_submit` | Submission result plus item overlaps | Refuses past dates, occupied dates and repeat puzzles |

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

`daily_grid` fills a grid from [`wordlist.ts`](../../packages/games/src/daily/nutshell/wordlist.ts)
(2,657 curated everyday words) against the `corners_3x3` patterns, checks the
result has not been used, and hands back ten words. The routine writes ten
clues. That is the whole job.

Two constraints worth knowing:

- **Supply is finite.** Measured, the current list yields 40+ consecutive
  distinct grids without exhausting; each proposal takes ~1s. When
  `daily_grid` reports it cannot find a fresh grid, the fix is more words in
  `wordlist.ts`, and a test will start failing before that becomes silent.
- **Fill quality varies.** Some proposals are lovely (`GLARE`, `PEACH`,
  `PLANT`), others are serviceable but dull (`BRA`, `YEW`, `EON`). Call
  `daily_grid` again with `avoidWords` to reroll. The words are all everyday —
  that is guaranteed by the list — but "everyday" is not the same as
  "interesting".

## Relationship to the CLI

[`scripts/daily-content.mjs`](../../scripts/daily-content.mjs) (`pnpm daily …`)
is the human's tool and the MCP's shared library — `preflight`, `queueRisk` and
the date helpers are imported from it, so a rule fixed in one place is fixed for
both. Use the CLI to review and approve drafts; the MCP has no approval tool, on
purpose. Deciding what goes live is not the routine's job.
