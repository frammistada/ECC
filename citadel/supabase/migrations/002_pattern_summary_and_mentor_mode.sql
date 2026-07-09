-- Citadel next-build migration 002.
-- Adds the running pattern summary (item 1) and mentor-mode onboarding (item 2)
-- to the per-user profile. All columns are nullable / defaulted so existing
-- rows and not-yet-onboarded users are valid.

alter table public.profiles
  add column if not exists pattern_summary text,
  add column if not exists mentor_mode text not null default 'steady',
  add column if not exists preferred_name text,
  add column if not exists onboarding_answers jsonb,
  add column if not exists onboarded boolean not null default false;

-- Keep mentor_mode to the two known values.
alter table public.profiles
  drop constraint if exists profiles_mentor_mode_check;
alter table public.profiles
  add constraint profiles_mentor_mode_check
  check (mentor_mode in ('direct', 'steady'));

-- Let a signed-in user update their own profile (mentor_mode override,
-- onboarding answers). Reads were already covered by "read own profile".
-- pattern_summary is written server-side with the service role, so a user
-- updating their own row can't forge it beyond what they could already say
-- in an entry; the mentor treats it as observation, not instruction.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
