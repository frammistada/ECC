-- Meditations: named entry pages, each its own chat with the mentor.
-- The daily journal becomes the day's automatic page (auto_day set);
-- users can also create standalone pages with their own name and a
-- per-page mentor mode (null = use the profile's mode).

create table public.meditations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  mentor_mode text check (mentor_mode in ('direct', 'steady')),
  auto_day date,
  created_at timestamptz not null default now()
);

-- One automatic page per user per day.
create unique index meditations_user_auto_day_idx
  on public.meditations (user_id, auto_day)
  where auto_day is not null;
create index meditations_user_created_idx
  on public.meditations (user_id, created_at desc);

alter table public.entries
  add column meditation_id uuid references public.meditations (id) on delete cascade;
create index entries_meditation_idx on public.entries (meditation_id);

alter table public.meditations enable row level security;

create policy "read own meditations" on public.meditations
  for select using ((select auth.uid()) = user_id);

create policy "create own meditations" on public.meditations
  for insert with check ((select auth.uid()) = user_id);

create policy "update own meditations" on public.meditations
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Deleting a page cascades to its entries/responses (FK actions run at
-- system level, so no extra delete policy is needed on entries).
create policy "delete own meditations" on public.meditations
  for delete using ((select auth.uid()) = user_id);

-- Backfill: group each user's existing entries into one automatic page
-- per day, named like the app's date line ("friday, july 10, 2026").
insert into public.meditations (user_id, name, auto_day, created_at)
select
  user_id,
  lower(trim(to_char(min(created_at), 'FMDay, FMMonth FMDD, YYYY'))),
  (created_at at time zone 'utc')::date,
  min(created_at)
from public.entries
where meditation_id is null
group by user_id, (created_at at time zone 'utc')::date;

update public.entries e
set meditation_id = m.id
from public.meditations m
where e.meditation_id is null
  and m.user_id = e.user_id
  and m.auto_day = (e.created_at at time zone 'utc')::date;
