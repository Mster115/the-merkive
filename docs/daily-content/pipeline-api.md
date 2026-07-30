# Daily content pipeline — API contract

Base URL (production): `https://the-merkive.vercel.app`

All routes below are implemented in `apps/web/src/app/api/admin/daily/` and
backed by `apps/web/src/server/daily/service.ts`.

## Auth

Every admin route is gated by `isPipelineAuthorized`
(`apps/web/src/server/daily/pipelineAuth.ts`). Present the shared secret as
either:

```
Authorization: Bearer $DAILY_PIPELINE_SECRET
```

or

```
x-mb-pipeline-secret: $DAILY_PIPELINE_SECRET
```

`DAILY_PIPELINE_SECRET` is set on Vercel for **Production and Preview**. Failure
returns `401 {"error":"nope","code":"unauthorized"}`.

Note the fail-closed rule: if the env var is unset and `NODE_ENV=production`,
the routes reject everything. Unset in development means "no auth required", so
local calls need no header.

> The secret is a bearer credential for writing puzzle content. It belongs in
> exactly one place — on a Mac, the login Keychain:
>
> ```bash
> security add-generic-password -U -a "$USER" -s merkive-daily-pipeline -w
> ```
>
> Both the CLI and the MCP server read it from there via
> [`scripts/secret.mjs`](../../scripts/secret.mjs), so it never needs to appear
> in a config file, a `.env`, a prompt, or a shell history line. `pnpm daily
> secret` reports whether it resolves and whether the deployment accepts it,
> without printing it.

## `GET /api/admin/daily/queue-status`

Query: `gameId` (optional; omit for all games).

```json
{
  "relay": {
    "queuedFutureDays": 2,
    "lookaheadDays": 3,
    "isSufficient": false,
    "queuedDates": ["2026-07-25", "2026-07-27"],
    "draftDates": ["2026-07-26"],
    "openDates": ["2026-07-28", "2026-07-29", "2026-07-30"]
  }
}
```

- `queuedFutureDays` — count of rows with `status = "queued"` and
  `puzzle_date >= today`, where today is the current **puzzle date** — the
  calendar date in America/New_York. The daily games flip once, globally, at
  midnight US Eastern, and every date in this API lives on that calendar.
- `lookaheadDays` — from `DAILY_QUEUE_LOOKAHEAD_DAYS`, default `3`.
- `isSufficient: false` is a **queue-health flag, not an error**. It means "fewer
  days queued than the lookahead target", which is exactly the signal the
  recurring routine exists to clear.

**Use `openDates`; do not derive dates from the count.** The three date arrays
are the answer to "where does the next puzzle go": `queuedDates` and
`draftDates` are what is taken from today onward, and `openDates` is what is
free, soonest first. Drafts appear in their own array precisely because
`queuedFutureDays` does not count them — a pack awaiting review for tomorrow is
invisible to the count, and submitting that date again would silently replace
it.

`firstFreeDate` and `planDates` in
[`scripts/daily-content.mjs`](../../scripts/daily-content.mjs) still implement
the old contiguous-queue derivation as a fallback for deployments that predate
the date arrays, and remain pinned by tests. New callers should not use them.

**The queue must never be one day deep.** The flip is one global moment —
midnight US Eastern — so at `queuedFutureDays === 1` every player worldwide
hits `no_puzzle_today` simultaneously when New York's clock strikes twelve; at
`0`, they already have. Two days is the floor — it is what makes one missed
routine run a non-event — which is why the default lookahead is 3. `pnpm daily
status` flags both cases.

## `GET /api/admin/daily/prompt`

Query: `gameId`, `puzzleDate` (both required).

```json
{ "gameId": "nexus", "puzzleDate": "2026-07-27", "prompt": "Generate a 3x3 trivia…" }
```

Returns that game's `generatePrompt(puzzleDate)` — the in-repo research brief.
Useful as a cross-check that the routine's embedded understanding still matches
the code, but it is a short summary, not a schema. The per-game documents here
are the fuller version.

## `POST /api/admin/daily/submit-pack`

Body:

```json
{
  "gameId": "nexus",
  "puzzleDate": "2026-07-27",
  "payload": { "…": "game-specific, see the per-game doc" },
  "sourceRefs": [{ "url": "https://…", "title": "…" }],
  "factCheck": { "status": "needs_review", "…": "free-form" }
}
```

- `gameId` and `puzzleDate` are required strings; missing either is
  `400 invalid_request`.
- `sourceRefs` must be an array or it is coerced to `[]`.
- `payload` is opaque to the platform and **includes the answer key**.
- `factCheck` is free-form and stored verbatim **except for `status`**, which is
  a closed two-value enum:

  | `factCheck.status` | Result |
  | --- | --- |
  | `"passed"` | pack lands `queued` |
  | `"needs_review"` | pack lands `draft` |
  | omitted, or no `factCheck` at all | pack lands `draft` |
  | anything else | `400 invalid_fact_check_status`, nothing written |

  The rejection is deliberate. An unrecognised status used to draft silently, so
  a pack that should have queued waited for a human nobody knew to summon —
  `"not_applicable"` and `"unreviewed"` both stranded eligible content this way.
  A game that asserts no facts has *met* its bar and should send `"passed"`.

The service builds the envelope `{ gameId, puzzleDate, payload, sourceRefs }`
and hands it to that game's `validatePack`. Rejection is
`400 {"code":"invalid_pack","error":"<the validator's message>"}` — the message
is specific, so surface it rather than retrying blind.

Success:

```json
{ "ok": true, "status": "queued" | "draft", "gameId": "nexus", "puzzleDate": "2026-07-27",
  "overlaps": [{ "item": "mars", "puzzleDate": "2026-05-02" }] }
```

`overlaps` lists items this puzzle shares with earlier ones. Informational — one
answer recurring after months is fine.

### Repeats are refused

Before storing, the service fingerprints the **assembled** payload and compares
it with every other puzzle for that game. A match returns
`409 {"code":"duplicate_puzzle"}` and nothing is written. Fingerprints are
canonical (sorted, trimmed, lower-cased), so reordering cells or reshuffling a
word bank does not disguise a repeat, and Relay keys on the start/end pair alone
because different decoys around the same chain play identically.

### ⚠️ Submissions overwrite by `(game_id, puzzle_date)`

`insertPack` upserts on conflict. Re-submitting a date that already has a
puzzle **replaces its payload and status**, with no warning and no version
history. Consequences the routine must respect:

- **Never submit for a date ≤ today.** Today's puzzle is live; overwriting it
  changes what new players receive mid-day. (Attempts already started keep
  their own copy of the state, so in-flight players are not corrupted — but
  players starting later get a different puzzle than the ones before them.)
- **Never re-submit a date you have already filled** unless you are
  deliberately replacing it. A retry after a network error is fine (idempotent);
  a re-run that recomputes target dates from a stale `queue-status` is not.
- Approving a draft is `status → "queued"`; rejecting **deletes the row**.

## `GET /api/admin/daily/history`

Query: `gameId` (required), `limit` (default 400, max 1000).

```json
{
  "gameId": "relay",
  "digests": [
    { "puzzleDate": "2026-07-20", "status": "queued", "fingerprint": "a1b2…",
      "itemTokens": ["9f8e…"], "recentItems": ["stone->whale"] }
  ]
}
```

A one-way content digest, not the puzzles. `fingerprint` identifies the whole
puzzle and `itemTokens` its individual answers, both hashed — so a content
generator can prove its puzzle is new without being handed an answer key it
would then have to be trusted not to leak. `recentItems` carries the items in
the clear **only** for dates already played, where every player saw them anyway.

## `GET /api/admin/daily/review`

Query: `gameId` (optional). Returns the full `daily_puzzles` rows with
`status = "draft"`, newest `puzzle_date` first — including `payload`, so this
response contains answer keys. Treat it as secret.

## `POST /api/admin/daily/review/{id}/decide`

Body: `{ "approve": true }` → row becomes `queued`.
Body: `{ "approve": false }` → row is **deleted**.

Response: `{ "ok": true, "id": "<id>", "approved": true|false }`.

## `POST /api/admin/daily/unqueue`

Body: `{ "gameId": "relay", "puzzleDate": "2026-08-15" }` → the row is
**deleted**, freeing both the date and the content fingerprint.

Response: `{ "ok": true, "gameId", "puzzleDate", "status", "deleted": true }`.

The mirror image of `submit-pack`, and it refuses on the same principle — it
will not touch a puzzle that is live or already played:

| Refusal | Code | Why |
| --- | --- | --- |
| `puzzleDate` ≤ today | `date_not_future` 400 | Today's puzzle is live; earlier ones are somebody's history |
| No puzzle at that date | `not_found` 404 | Nothing to remove |
| Attempts reference the row | `puzzle_has_attempts` 409 | `daily_attempts.puzzle_id` **cascades on delete**, so removing a played puzzle would silently destroy attempts and the streaks derived from them |

Both guards are server-side, because the CLI is not the only possible caller.

Deleting a row also releases its fingerprint, so that content stops counting as
"already used" and may be generated again. That is what makes a purge-then-refill
run possible without every new pack colliding with the one it replaced.

**This is deliberately not an MCP tool.** Like draft approval, deciding to
destroy queued content is the operator's call, not a content routine's.

## Worked example

Prefer the CLI, which applies every guard above:

```bash
node scripts/daily-content.mjs secret        # is it configured, and does it work?
node scripts/daily-content.mjs status
node scripts/daily-content.mjs submit pack.json --yes
```

The raw equivalents, if you need them:

```bash
curl -s "https://the-merkive.vercel.app/api/admin/daily/queue-status" \
  -H "Authorization: Bearer $(security find-generic-password -s merkive-daily-pipeline -w)"
```

```bash
curl -s -X POST "https://the-merkive.vercel.app/api/admin/daily/submit-pack" \
  -H "Authorization: Bearer $(security find-generic-password -s merkive-daily-pipeline -w)" \
  -H "Content-Type: application/json" \
  --data @pack.json
```

## Unrelated secrets that live next to this one

`CRON_SECRET` (Vercel's nightly `/api/sweep` cron, `0 3 * * *` in
`vercel.json`) and `MB_SWEEP_SECRET` are **not** part of this pipeline. They are
listed only so nobody assumes one secret covers everything.
