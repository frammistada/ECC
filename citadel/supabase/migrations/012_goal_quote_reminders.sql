-- Two more reminder types (paid), alongside the daily reflection reminder
-- from migration 011. All three share reminder_timezone and the
-- push_subscriptions table; each carries its own enable flag + schedule +
-- one-per-day guard.
--
-- Goal reminder: one push a day reminding the user of their stated goal.
-- The goal text is profiles.aim (the "what you're trying to accomplish"
-- field from Who am I) — no new field; it is already an explicit,
-- user-written current goal. If aim is empty the cron skips it.
--
-- Quote reminder: N short stoic-toned lines per day (default 1, max 6),
-- evenly spaced across 24h from a fixed 08:00 local base.
-- quote_reminder_slots_sent counts how many of today's slots have fired,
-- so the hourly cron sends at most one per slot and never bursts.
alter table public.profiles
  add column if not exists goal_reminder_enabled boolean not null default false,
  add column if not exists goal_reminder_time text,
  add column if not exists goal_reminder_last_sent date,
  add column if not exists quote_reminder_enabled boolean not null default false,
  add column if not exists quote_reminder_count integer not null default 1
    check (quote_reminder_count between 1 and 6),
  add column if not exists quote_reminder_last_sent date,
  add column if not exists quote_reminder_slots_sent integer not null default 0;
