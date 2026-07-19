-- 0001_init.sql: Complete Supabase schema and RPC for The Merkive

-- Custom Enums
create type room_status as enum ('lobby', 'in_game', 'ended', 'expired');
create type match_status as enum ('active', 'completed', 'aborted');
create type friendship_status as enum ('pending', 'accepted', 'declined', 'blocked');

-- 1. Profiles (future-facing, references auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Friendships (future-facing)
create table friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_user_friend unique (user_id, friend_id)
);

-- 3. Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique constraint code_4_char check (char_length(code) = 4),
  status room_status not null default 'lobby',
  host_seat integer null,
  game_id text null,
  settings jsonb not null default '{}'::jsonb,
  max_players integer not null default 8,
  paused_at timestamptz null,
  last_match jsonb null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Seats
create table seats (
  room_id uuid not null references rooms(id) on delete cascade,
  seat_index integer not null,
  player_uid uuid not null,
  display_name text not null,
  avatar_id text not null,
  connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disconnected_at timestamptz null,
  abandoned boolean not null default false,
  primary key (room_id, seat_index)
);

-- 5. Spectators
create table spectators (
  room_id uuid not null references rooms(id) on delete cascade,
  uid uuid not null,
  display_name text not null,
  avatar_id text not null,
  connected boolean not null default true,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, uid)
);

-- 6. Matches
-- Cumulative scores jsonb is stored directly inside matches.scores to mirror MatchRecord in store/types.ts
create table matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  game_id text not null,
  status match_status not null default 'active',
  phase text not null,
  seed text not null,
  version bigint not null default 0,
  settings jsonb not null default '{}'::jsonb,
  public_state jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  timer jsonb null,
  over boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz null
);

-- 7. Match Private State (one row per (match_id, seat_index))
create table match_private_state (
  match_id uuid not null references matches(id) on delete cascade,
  seat_index integer not null,
  state jsonb not null default '{}'::jsonb,
  primary key (match_id, seat_index)
);

-- 8. Match Events (append-only, per-match seq)
create table match_events (
  id bigserial primary key,
  match_id uuid not null references matches(id) on delete cascade,
  seq bigint not null,
  event jsonb not null,
  created_at timestamptz not null default now(),
  constraint unique_match_seq unique (match_id, seq)
);

-- 9. Content Packs
create table content_packs (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  title text not null,
  locale text not null default 'en',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_rooms_code on rooms (code);
create index idx_rooms_status on rooms (status);
create index idx_seats_room_id on seats (room_id);
create index idx_matches_room_id_status on matches (room_id, status);
create index idx_match_events_match_seq on match_events (match_id, seq);

-- Row Level Security (RLS)
-- All client access to game and room state flows through Next.js server routes using the service role key.
-- Direct client access via anon or authenticated roles is strictly forbidden.
alter table profiles enable row level security;
alter table friendships enable row level security;
alter table rooms enable row level security;
alter table seats enable row level security;
alter table spectators enable row level security;
alter table matches enable row level security;
alter table match_private_state enable row level security;
alter table match_events enable row level security;
alter table content_packs enable row level security;

-- Do not add any RLS policies for anon or authenticated roles.
-- Service role bypasses RLS automatically.
-- This ensures match_private_state and all room state are strictly unreadable directly by clients.

-- Atomic CAS RPC Function
create or replace function apply_match_update(
  p_match_id uuid,
  p_expected_version bigint,
  p_phase text,
  p_public_state jsonb,
  p_private_patch jsonb,
  p_scores_patch jsonb,
  p_timer jsonb,
  p_timer_set boolean,
  p_over boolean,
  p_status text,
  p_ended_at timestamptz,
  p_events jsonb
) returns boolean
language plpgsql
security definer
as $$
declare
  v_current_version bigint;
  v_base_seq bigint;
begin
  -- Lock and verify match version
  select version into v_current_version
  from matches
  where id = p_match_id
  for update;

  if not found or v_current_version <> p_expected_version then
    return false;
  end if;

  -- Update matches record
  update matches
  set
    version = version + 1,
    phase = p_phase,
    public_state = p_public_state,
    scores = case
      when p_scores_patch is not null then coalesce(scores, '{}'::jsonb) || p_scores_patch
      else scores
    end,
    timer = case
      when p_timer_set then p_timer
      else timer
    end,
    over = case
      when p_over is not null then p_over
      else over
    end,
    status = case
      when p_status is not null then (p_status)::match_status
      else status
    end,
    ended_at = case
      when p_ended_at is not null then p_ended_at
      else ended_at
    end
  where id = p_match_id;

  -- Upsert per-seat private state
  if p_private_patch is not null and p_private_patch <> 'null'::jsonb then
    insert into match_private_state (match_id, seat_index, state)
    select p_match_id, (key)::integer, value
    from jsonb_each(p_private_patch)
    on conflict (match_id, seat_index)
    do update set state = excluded.state;
  end if;

  -- Append events with per-match sequence
  if p_events is not null and jsonb_array_length(p_events) > 0 then
    select coalesce(max(seq), 0) into v_base_seq
    from match_events
    where match_id = p_match_id;

    insert into match_events (match_id, seq, event)
    select p_match_id, v_base_seq + row_number() over (), elem
    from jsonb_array_elements(p_events) as elem;
  end if;

  return true;
end;
$$;

revoke all on function apply_match_update from public, anon, authenticated;
grant execute on function apply_match_update to service_role;
