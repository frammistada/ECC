-- Citadel migration 006: "Who am I" — static background for the mentor.
-- Columns on profiles rather than a new table: strictly 1:1 with the user,
-- preferred_name (which the screen reuses) already lives here, the reflect
-- route already reads profiles with select('*') on every entry, and the
-- existing "update own profile" policy covers writes. Only the user edits
-- these; nothing machine-written, nothing summarized.

alter table public.profiles
  add column if not exists age integer check (age between 5 and 120),
  add column if not exists aim text,
  add column if not exists about_note text;
