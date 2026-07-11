-- No-mentor journaling (paid): a full entry written deliberately without
-- a mentor reply. Same entries table and flow as a reflection — the type
-- marks that the missing response is chosen, not a failed save. These
-- entries still feed pattern_summary and the activity log; they are
-- excluded from the paywall/milestone counts, which filter 'reflection'.
alter table public.entries
  drop constraint if exists entries_entry_type_check;
alter table public.entries
  add constraint entries_entry_type_check
  check (entry_type in ('reflection', 'checkin', 'journal'));
