-- ============================================================
-- Barkadash — AI Suggested Spots (Navi's suggestions)
-- Run this in the Supabase SQL Editor (public schema).
-- Depends on: is_trip_member(uuid) from trip_polls.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. AI spots table (cached Navi suggestions, generated on
--    demand and only refreshed when the user taps refresh so
--    the AI is not exhausted on every visit).
-- ------------------------------------------------------------
create table if not exists public.trip_ai_spots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null,               -- DINING / SUNSET / HIDDEN / ...
  name text not null,
  address text,
  place_id text,
  rating numeric,
  user_ratings_total integer,
  price_level integer,
  photo_reference text,
  description text,
  match_score integer,                  -- AI "how well it fits your barkada"
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_ai_spots_trip_category_idx
  on public.trip_ai_spots(trip_id, category);

-- ------------------------------------------------------------
-- 2. Row Level Security — shared per-trip cache, so every
--    accepted member may read and regenerate suggestions.
-- ------------------------------------------------------------
alter table public.trip_ai_spots enable row level security;

drop policy if exists "Members can view trip AI spots" on public.trip_ai_spots;
create policy "Members can view trip AI spots"
  on public.trip_ai_spots
  for select
  using (public.is_trip_member(trip_id));

drop policy if exists "Members can create trip AI spots" on public.trip_ai_spots;
create policy "Members can create trip AI spots"
  on public.trip_ai_spots
  for insert
  with check (public.is_trip_member(trip_id));

drop policy if exists "Members can update trip AI spots" on public.trip_ai_spots;
create policy "Members can update trip AI spots"
  on public.trip_ai_spots
  for update
  using (public.is_trip_member(trip_id));

drop policy if exists "Members can delete trip AI spots" on public.trip_ai_spots;
create policy "Members can delete trip AI spots"
  on public.trip_ai_spots
  for delete
  using (public.is_trip_member(trip_id));

-- ------------------------------------------------------------
-- 3. Privileges (required! raw-SQL tables are NOT auto-granted)
-- ------------------------------------------------------------
grant select, insert, update, delete on table public.trip_ai_spots to authenticated;
grant select on table public.trip_ai_spots to anon;
