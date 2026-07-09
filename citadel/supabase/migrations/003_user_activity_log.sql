-- Citadel next-build migration 003.
-- Behavioral instrumentation (item 3): one row per reflection, for later
-- analysis of how tone/engagement move over time. No logic acts on this yet.

create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete set null,
  goal_status text,                 -- 'complete' | 'missed' | null (no goals yet)
  mentor_mode text,                 -- snapshot of the mode at write time
  entry_length integer,             -- rough engagement proxy
  created_at timestamptz not null default now()
);

create index if not exists user_activity_log_user_created_idx
  on public.user_activity_log (user_id, created_at desc);

alter table public.user_activity_log enable row level security;

-- Users may read their own activity; rows are written server-side with the
-- service role, so there is no user insert policy (nothing to forge).
drop policy if exists "read own activity" on public.user_activity_log;
create policy "read own activity" on public.user_activity_log
  for select using ((select auth.uid()) = user_id);
