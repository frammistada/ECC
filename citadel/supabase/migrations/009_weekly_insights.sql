-- Citadel migration 009: weekly insights — "To Myself". A user-facing
-- note on one bounded week, distinct from profiles.pattern_summary (the
-- mentor's rolling cross-time working memory). One row per user per
-- calendar week (Monday-start, UTC); rows are never regenerated or
-- overwritten, so past weeks can be looked back on. Written server-side
-- with the service role after a lazy on-visit check.

create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null, -- the Monday the week began (UTC)
  content text not null,
  entry_count integer not null default 0,   -- full reflections that week
  checkin_count integer not null default 0, -- micro check-ins that week
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_insights_user_week_idx
  on public.weekly_insights (user_id, week_start desc);

alter table public.weekly_insights enable row level security;

-- Users read their own; inserts happen server-side only.
drop policy if exists "read own insights" on public.weekly_insights;
create policy "read own insights" on public.weekly_insights
  for select using ((select auth.uid()) = user_id);
