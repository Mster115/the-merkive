create type daily_puzzle_status as enum ('draft', 'queued');

create table daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  puzzle_date date not null,
  status daily_puzzle_status not null default 'draft',
  payload jsonb not null,
  source_refs jsonb not null default '[]'::jsonb,
  fact_check jsonb null,
  generated_by text not null default 'pipeline',
  created_at timestamptz not null default now(),
  constraint uniq_game_date unique (game_id, puzzle_date)
);
create index idx_daily_puzzles_lookup on daily_puzzles (game_id, status, puzzle_date desc);

create table daily_devices (
  id uuid primary key,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  recovery_code text null unique
);

create table daily_attempts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references daily_devices(id) on delete cascade,
  puzzle_id uuid not null references daily_puzzles(id) on delete cascade,
  game_id text not null,
  puzzle_date date not null,
  phase text not null default 'start',
  public_state jsonb not null default '{}'::jsonb,
  secret_state jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  status text not null default 'in_progress',
  -- True only when completed_at fell on puzzle_date itself (in the device's
  -- timezone at completion time). An archive replay solved well after its
  -- puzzle_date is still tracked (counts toward totalSolved) but must never
  -- retroactively patch a streak gap — see apps/web/src/server/daily/streaks.ts.
  on_time boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  duration_ms bigint null,
  score numeric null,
  share_text text null,
  updated_at timestamptz not null default now(),
  constraint uniq_device_puzzle unique (device_id, puzzle_id)
);
create index idx_daily_attempts_streak on daily_attempts (device_id, game_id, puzzle_date desc);

alter table daily_puzzles enable row level security;
alter table daily_devices enable row level security;
alter table daily_attempts enable row level security;
-- No anon/authenticated policies: every access path is a Next.js server
-- route using the service-role key. Do not add anon/authenticated policies.
