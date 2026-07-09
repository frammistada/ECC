-- Citadel next-build migration 004.
-- Consequence mechanic (item 4): an optional accountability contact. Fully
-- skippable — if unset, the feature is simply inactive for that user.
-- Stored on the profile; only ever read/written server-side for sending.

alter table public.profiles
  add column if not exists accountability_name text,
  add column if not exists accountability_email text;
