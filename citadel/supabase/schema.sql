-- Citadel schema. Run once in the Supabase SQL editor (or via supabase db push).
-- Three tables, per the spec: profiles (users), entries, responses. Nothing else.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  subscription_status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Long-term memory + tone, added in migration 002.
  pattern_summary text,
  mentor_mode text not null default 'steady'
    check (mentor_mode in ('direct', 'steady')),
  preferred_name text,
  onboarding_answers jsonb,
  onboarded boolean not null default false,
  -- Optional accountability contact (migration 004).
  accountability_name text,
  accountability_email text,
  created_at timestamptz not null default now()
);

-- Named entry pages (migration 005). Each is its own chat with the mentor;
-- auto_day marks the day's automatic page. mentor_mode null = profile's mode.
create table public.meditations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  mentor_mode text check (mentor_mode in ('direct', 'steady')),
  auto_day date,
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  meditation_id uuid references public.meditations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Behavioral instrumentation (migration 003). One row per reflection;
-- groundwork for a future adaptive-tone layer. No logic acts on it yet.
create table public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete set null,
  goal_status text,
  mentor_mode text,
  entry_length integer,
  created_at timestamptz not null default now()
);

create unique index meditations_user_auto_day_idx
  on public.meditations (user_id, auto_day)
  where auto_day is not null;
create index meditations_user_created_idx
  on public.meditations (user_id, created_at desc);
create index entries_meditation_idx on public.entries (meditation_id);
create index entries_user_created_idx on public.entries (user_id, created_at desc);
create index responses_entry_idx on public.responses (entry_id);
create index profiles_stripe_customer_idx on public.profiles (stripe_customer_id);
create index user_activity_log_user_created_idx
  on public.user_activity_log (user_id, created_at desc);

-- Entries are private. RLS everywhere; the Stripe webhook uses the
-- service-role key and is the only thing that writes subscription_status.
alter table public.profiles enable row level security;
alter table public.meditations enable row level security;
alter table public.entries enable row level security;
alter table public.responses enable row level security;
alter table public.user_activity_log enable row level security;

-- auth.uid() wrapped in (select ...) so Postgres evaluates it once per
-- query instead of once per row — Supabase's own recommendation at scale.
create policy "read own profile" on public.profiles
  for select using ((select auth.uid()) = id);

-- Users may update their own mentor_mode, name, and onboarding answers.
create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Activity log is read-only to the user; rows are written server-side.
create policy "read own activity" on public.user_activity_log
  for select using ((select auth.uid()) = user_id);

create policy "read own meditations" on public.meditations
  for select using ((select auth.uid()) = user_id);

create policy "create own meditations" on public.meditations
  for insert with check ((select auth.uid()) = user_id);

create policy "update own meditations" on public.meditations
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own meditations" on public.meditations
  for delete using ((select auth.uid()) = user_id);

create policy "read own entries" on public.entries
  for select using ((select auth.uid()) = user_id);

create policy "write own entries" on public.entries
  for insert with check ((select auth.uid()) = user_id);

create policy "read own responses" on public.responses
  for select using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );

create policy "write own responses" on public.responses
  for insert with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = (select auth.uid())
    )
  );

-- Create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- This runs only as an auth.users insert trigger, never as a public RPC.
revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
