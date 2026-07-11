-- Sleep/wake times (migration 013). The user's waking window, used to space
-- quote reminders across the hours they're actually awake instead of a flat
-- 24h (which pushed higher counts overnight). Wall-clock "HH:MM" in the
-- shared reminder_timezone; null falls back to 07:00 wake / 23:00 sleep in
-- code. Stored on the profile as general day info — currently only the quote
-- reminder consumes it.
alter table public.profiles
  add column if not exists wake_time text,
  add column if not exists sleep_time text;
