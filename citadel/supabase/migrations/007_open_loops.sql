-- Citadel migration 007: open loops — intentions, commitments, and
-- unresolved tensions the mentor should follow up on later if the user
-- doesn't bring them back up. Extracted by a cheap Haiku call after each
-- reflect (0–2 per entry, none forced); the 3 most recent unresolved are
-- injected into the mentor's context. v1 resolution is manual: the user
-- dismisses a loop from settings. Rows are written server-side.

create table if not exists public.open_loops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete set null,
  description text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists open_loops_user_open_idx
  on public.open_loops (user_id, created_at desc)
  where not resolved;

alter table public.open_loops enable row level security;

-- Users read their own loops and may mark them resolved (dismiss).
-- Inserts happen server-side with the service role — no insert policy.
drop policy if exists "read own loops" on public.open_loops;
create policy "read own loops" on public.open_loops
  for select using ((select auth.uid()) = user_id);

drop policy if exists "resolve own loops" on public.open_loops;
create policy "resolve own loops" on public.open_loops
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
