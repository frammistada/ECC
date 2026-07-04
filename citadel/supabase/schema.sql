-- Citadel schema. Run once in the Supabase SQL editor (or via supabase db push).
-- Three tables, per the spec: profiles (users), entries, responses. Nothing else.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  subscription_status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index entries_user_created_idx on public.entries (user_id, created_at desc);
create index responses_entry_idx on public.responses (entry_id);
create index profiles_stripe_customer_idx on public.profiles (stripe_customer_id);

-- Entries are private. RLS everywhere; the Stripe webhook uses the
-- service-role key and is the only thing that writes subscription_status.
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.responses enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "read own entries" on public.entries
  for select using (auth.uid() = user_id);

create policy "write own entries" on public.entries
  for insert with check (auth.uid() = user_id);

create policy "read own responses" on public.responses
  for select using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

create policy "write own responses" on public.responses
  for insert with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
