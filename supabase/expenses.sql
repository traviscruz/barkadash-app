-- ============================================================
-- Barkadash — Shared Expenses (Ledger)
-- Run this in the Supabase SQL Editor (public schema).
--
-- Depends on: is_trip_member(uuid) from trip_polls.sql
--
-- What this adds:
--   1. expenses          — one row per expense in a trip
--      (payer, amount, category, split mode/count, notes)
--   2. expense_photos    — receipt photos per expense (Supabase Storage paths)
--   3. Storage bucket    — 'expense-receipts' (public) + object policies
--   4. updated_at trigger helper (create-or-replace, shared)
--   5. RLS
--        · Accepted trip members can VIEW expenses + photos
--        · Accepted members can ADD expenses (payer = the uploader)
--        · Only the uploader (created_by) can UPDATE / DELETE an expense
--   6. Realtime publication for the two new tables
--   7. Grants
-- ============================================================

-- ------------------------------------------------------------
-- 1. Expenses table
--    payer_id  → the member who paid (profiles.id)
--    split_mode → 'split' | 'pinaluwal' | 'solo'
--    split_count → how many ways the expense is split (real joined members)
-- ------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payer_id uuid not null references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  title text not null check (char_length(trim(title)) > 0),
  amount numeric not null check (amount > 0),
  category text not null default 'General',
  split_mode text not null default 'split' check (split_mode in ('split', 'pinaluwal', 'solo')),
  split_count integer not null default 1 check (split_count >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration for existing databases (idempotent)
alter table public.expenses add column if not exists created_by uuid references public.profiles(id);
update public.expenses set created_by = payer_id where created_by is null;

create index if not exists expenses_trip_id_idx
  on public.expenses(trip_id);

create index if not exists expenses_payer_id_idx
  on public.expenses(payer_id);

-- ------------------------------------------------------------
-- 2. Expense photos table (receipt images → storage_path)
-- ------------------------------------------------------------
create table if not exists public.expense_photos (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists expense_photos_expense_id_idx
  on public.expense_photos(expense_id);

-- ------------------------------------------------------------
-- 3. Shared updated_at trigger helper
--    (create-or-replace so it's safe to re-run across all feature SQL)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Storage bucket for receipt photos (public read)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', true)
on conflict (id) do update set public = true;

-- Public read (public bucket)
drop policy if exists "Anyone can view expense receipts" on storage.objects;
create policy "Anyone can view expense receipts"
  on storage.objects
  for select
  using (bucket_id = 'expense-receipts');

-- Authenticated users can upload
drop policy if exists "Authenticated users can upload expense receipts" on storage.objects;
create policy "Authenticated users can upload expense receipts"
  on storage.objects
  for insert
  with check (bucket_id = 'expense-receipts' and auth.role() = 'authenticated');

-- Uploaders can update / delete their own objects
-- NOTE: owner_id is TEXT in this project's storage schema, so we cast both
-- sides to text to avoid "operator does not exist: text = uuid".
drop policy if exists "Users can update their own expense receipts" on storage.objects;
create policy "Users can update their own expense receipts"
  on storage.objects
  for update
  using (bucket_id = 'expense-receipts' and owner_id::text = auth.uid()::text);

drop policy if exists "Users can delete their own expense receipts" on storage.objects;
create policy "Users can delete their own expense receipts"
  on storage.objects
  for delete
  using (bucket_id = 'expense-receipts' and owner_id::text = auth.uid()::text);

-- ------------------------------------------------------------
-- 5. Realtime (so expenses/photos update live for everyone)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expense_photos'
  ) then
    alter publication supabase_realtime add table public.expense_photos;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. Row Level Security
-- ------------------------------------------------------------
alter table public.expenses       enable row level security;
alter table public.expense_photos enable row level security;

-- Expenses: accepted members may view
drop policy if exists "Members can view expenses" on public.expenses;
create policy "Members can view expenses"
  on public.expenses
  for select
  using (public.is_trip_member(trip_id));

-- Expenses: accepted members may add (any member can log an expense,
-- even if someone else in the trip paid for it)
drop policy if exists "Members can create expenses" on public.expenses;
create policy "Members can create expenses"
  on public.expenses
  for insert
  with check (public.is_trip_member(trip_id));

-- Expenses: only the uploader may update
drop policy if exists "Members can update expenses" on public.expenses;
create policy "Members can update expenses"
  on public.expenses
  for update
  using (auth.uid() = created_by);

-- Expenses: only the uploader may delete
drop policy if exists "Members can delete expenses" on public.expenses;
create policy "Members can delete expenses"
  on public.expenses
  for delete
  using (auth.uid() = created_by);

-- Photos: accepted members may view
drop policy if exists "Members can view expense photos" on public.expense_photos;
create policy "Members can view expense photos"
  on public.expense_photos
  for select
  using (
    public.is_trip_member(
      (select trip_id from public.expenses where id = expense_id)
    )
  );

-- Photos: accepted members may add
drop policy if exists "Members can create expense photos" on public.expense_photos;
create policy "Members can create expense photos"
  on public.expense_photos
  for insert
  with check (
    public.is_trip_member(
      (select trip_id from public.expenses where id = expense_id)
    )
  );

-- Photos: accepted members may delete
drop policy if exists "Members can delete expense photos" on public.expense_photos;
create policy "Members can delete expense photos"
  on public.expense_photos
  for delete
  using (
    public.is_trip_member(
      (select trip_id from public.expenses where id = expense_id)
    )
  );

-- ------------------------------------------------------------
-- 7. Grants (raw-SQL tables need explicit grants)
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant all on table public.expenses       to authenticated;
grant all on table public.expense_photos to authenticated;

grant select on table public.expenses       to anon;
grant select on table public.expense_photos to anon;
