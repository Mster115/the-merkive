# The Merkive — Supabase Database Layer

This package contains the SQL migrations, row type definitions, and seed data for the Supabase production persistence layer of The Merkive.

## Step-by-Step Deployment Guide

### 1. Create a Supabase Project
- Head to [supabase.com](https://supabase.com) and create a new project.
- Take note of your Project URL, Anon Key, and Service Role Key from Project Settings -> API.

### 2. Run Database Migrations
Run the initial schema migration in `supabase/migrations/0001_init.sql`:
- **Via Supabase Dashboard**: Paste the contents of `supabase/migrations/0001_init.sql` into the SQL Editor and click **Run**.
- **Via Supabase CLI**:
  ```bash
  supabase db push
  ```

### 3. (Optional) Seed Starter Data
- Run `seed.sql` in the SQL Editor to insert default content packs.

### 4. Configure Vercel / Production Environment Variables
Set the following environment variables in your deployment environment (e.g. Vercel Project Settings):

```env
MB_MODE=supabase
NEXT_PUBLIC_MB_MODE=supabase

NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

MB_SWEEP_SECRET=<a-random-secret-token>
```

### 5. Set Up Vercel Cron Sweeper
In serverless environments (like Vercel), in-process interval sweepers do not run continuously. Set up a Vercel Cron Job hitting `POST /api/sweep` every minute.

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/sweep",
      "schedule": "* * * * *"
    }
  ]
}
```

Ensure Vercel (or your external cron service) passes the header `x-mb-sweep-secret: <MB_SWEEP_SECRET>` when invoking `/api/sweep`.

---

## Architecture & Limitations

### 1. Timer Latency
In Supabase mode, game timers rely on client-side action nudges and the 1-minute sweeper cron interval. Expired timers will process whenever a player submits an action or when the cron sweeper runs.

### 2. Presence Heartbeat Granularity
Client presence is tracked via HTTP heartbeats every 20 seconds (`POST /api/rooms/[code]/presence`). Seats and spectators are marked connected iff `connected = true` AND `last_seen_at` is within the last 45 seconds.

### 3. Channel-Name Capability Model
Realtime broadcast channels use capability-based names:
- Room public channel: `room:{CODE}:public`
- Seat private channel: `room:{CODE}:seat:{player_uid}`

`player_uid` tokens are unguessable UUIDs known only to the server and the specific client.
**Upgrade Path**: For enhanced security in production, enable Supabase Realtime Authorization (RLS on `realtime.messages`) to restrict channel subscription access.

### 4. Single-Region Latency Note
For optimal performance and minimal database RPC roundtrip latency, deploy Vercel serverless functions in the same cloud region as your Supabase Postgres database.
