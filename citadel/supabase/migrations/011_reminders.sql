-- Daily reminder (paid): one push notification per day nudging the user to
-- reflect. Single reminder only — no multiple times, no custom message.
--
-- Timezone handling: reminder_time is the user's wall-clock time as "HH:MM"
-- and reminder_timezone is their IANA zone (e.g. "Europe/Istanbul"), read
-- from Intl in the browser. The cron computes each user's current local
-- time from these to decide who is due. If the browser can't report a zone
-- we fall back to "UTC" and store that, so a reminder still fires (at the
-- user's UTC-o'clock) rather than not at all. reminder_last_sent is the
-- local date a reminder last went out, so the cron sends at most once per
-- local day even though it runs every hour.
alter table public.profiles
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_time text,
  add column if not exists reminder_timezone text,
  add column if not exists reminder_last_sent date;

-- Web-push subscriptions. One row per browser/device a user has enabled;
-- the cron and the test endpoint fan a push out to every row for a user.
-- Written client-side after PushManager.subscribe; pruned server-side when
-- the push service reports the endpoint gone (404/410).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage their own subscriptions; the cron reads them with the
-- service role (bypasses RLS), never the anon/authenticated client.
create policy "read own push subs" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);

create policy "insert own push subs" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);

create policy "delete own push subs" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);
