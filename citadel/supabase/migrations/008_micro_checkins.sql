-- Citadel migration 008: micro check-ins — a lightweight entry type for
-- days a full reflection is too much. Columns on entries rather than a
-- separate table: check-ins must flow into the same short-term memory and
-- pattern-summary queries as reflections (both read entries), and a
-- second table would fork every context query for no gain. entry_type
-- lets the paywall count and milestones filter to full reflections.
-- Existing rows take the 'reflection' default.

alter table public.entries
  add column if not exists entry_type text not null default 'reflection'
    check (entry_type in ('reflection', 'checkin')),
  add column if not exists checkin_state text
    check (checkin_state in ('held', 'slipped', 'neither'));
