# `@merky/db` — daily-games schema

Row types (`src/types.ts`) and the Postgres schema (`supabase/migrations/`) for
the Supabase-backed daily store. Multiplayer rooms are ephemeral and live in
`@merky/party`; nothing in here touches them.

## The database

One project: **`merkive-supabase`**, ref `fyclkgotmevlxfnimisx`, region
`us-east-1`. There is a second, unrelated project on the same Supabase account
(`osint`) — check the ref before you push anything.

`apps/web` reaches it through `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
With those unset the app falls back to an in-memory store, which is what makes
`pnpm dev` work without credentials — and which
[`store/index.ts`](../../apps/web/src/server/daily/store/index.ts) refuses to do
in production, because losing every puzzle and streak on a cold start reads as
"the feature is broken" rather than "the deploy is misconfigured".

> The in-memory store is per-process, and Next's dev server recycles route
> modules on recompile. Locally you will see puzzles vanish mid-session; that is
> the store being rebuilt, not a bug in the game. Re-seed and carry on.

## Applying a migration

The CLI is not initialised in this repo (no `config.toml`), so the first step of
a fresh checkout is to link. Run from `packages/db`, since that is where the CLI
looks for `supabase/`:

```bash
supabase link --project-ref fyclkgotmevlxfnimisx
```

Then check what the remote is missing before changing it:

```bash
supabase migration list
```

`local` and `remote` columns should agree on everything except the migration you
are adding. If they disagree elsewhere, stop and work out why — do not push over
it. Preview the change, apply it, and confirm:

```bash
supabase db push --dry-run
supabase db push
supabase migration list
```

Link state lands in `packages/db/supabase/.temp/` and is gitignored.

## Writing one

- **Numbered and additive.** `000N_short_name.sql`, and prefer adding a nullable
  or defaulted column to changing an existing one. A deploy is not atomic with a
  migration: the old code runs against the new schema for a few seconds, and the
  new code runs against the old schema for anyone mid-request.
- **Never edit a migration that has been pushed.** Write another one.
- **Both stores, or neither.** Every schema change needs matching work in
  [`store/memory.ts`](../../apps/web/src/server/daily/store/memory.ts) and
  [`store/supabase.ts`](../../apps/web/src/server/daily/store/supabase.ts) —
  they implement one `DailyStore` interface and the platform suite runs against
  the memory one. A change that only lands in Supabase passes every test and
  fails in production.
- **Make the new column optional in `src/types.ts`.** Rows written before the
  migration will not have it. `seen_howto?: string[]` reads as `undefined` on an
  old row, and every consumer defaults it.

`seed.sql` is sample content for a local database. It is not applied by
`db push` and must never be run against production.

## Ordering a deploy

Apply the migration **before** the code that depends on it, and write the code
so the gap is survivable. `0002_howto_seen.sql` is the worked example: reads use
`select *`, so a missing column simply reads as "unseen", and the write path
fails closed on a flag nobody loses sleep over. The modal re-appearing once is a
cost worth paying for a deploy that cannot break.
