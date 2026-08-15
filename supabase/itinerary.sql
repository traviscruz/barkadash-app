-- ============================================================
-- Barkadash — Shared Itinerary (DB-backed) + Reactions
-- Run this in the Supabase SQL Editor (public schema).
--
-- What this adds:
--   1. trip_itinerary_items  — shared per-day itinerary items
--      (place from Google Places, time, tag, note, creator, updated-by)
--   2. trip_itinerary_reactions — like / dislike per item, one per user
--   3. notifications columns for deep-linking:
--      trip_id + itinerary_item_id
--   4. RLS (members can add; only the creator edits/deletes their own item)
--   5. Realtime publication for the new tables
--   6. Grants
-- ============================================================

-- ------------------------------------------------------------
-- 1. Itinerary items table
-- ------------------------------------------------------------
create table if not exists public.trip_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null default 1,
  title text not null,
  time text,
  tag text not null default 'ACTIVITY'
    check (tag in ('TRANSPORT', 'ACTIVITY', 'FOOD', 'MEETUP')),
  location text,
  est_cost text,
  note text,
  is_completed boolean not null default false,
  place_id text,
  place_name text,
  place_address text,
  photo_reference text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create index if not exists trip_itinerary_items_trip_day_idx
  on public.trip_itinerary_items(trip_id, day_number);

create index if not exists trip_itinerary_items_created_by_idx
  on public.trip_itinerary_items(created_by);

-- ------------------------------------------------------------
-- 2. Reactions table (one reaction per (item, user) — like or dislike)
-- ------------------------------------------------------------
create table if not exists public.trip_itinerary_reactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.trip_itinerary_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_itinerary_reactions_item_user_key unique (item_id, user_id)
);

create index if not exists trip_itinerary_reactions_item_id_idx
  on public.trip_itinerary_reactions(item_id);

create index if not exists trip_itinerary_reactions_user_id_idx
  on public.trip_itinerary_reactions(user_id);

-- ------------------------------------------------------------
-- 3. Notifications deep-linking columns
-- ------------------------------------------------------------
alter table public.notifications
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

alter table public.notifications
  add column if not exists itinerary_item_id uuid
  references public.trip_itinerary_items(id) on delete set null;

-- ------------------------------------------------------------
-- 4. Realtime (so the itinerary updates live for everyone)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_itinerary_items'
  ) then
    alter publication supabase_realtime add table public.trip_itinerary_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_itinerary_reactions'
  ) then
    alter publication supabase_realtime add table public.trip_itinerary_reactions;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. Row Level Security
-- ------------------------------------------------------------
alter table public.trip_itinerary_items enable row level security;
alter table public.trip_itinerary_reactions enable row level security;

-- Items: accepted members may view
drop policy if exists "Members can view trip itinerary items" on public.trip_itinerary_items;
create policy "Members can view trip itinerary items"
  on public.trip_itinerary_items
  for select
  using (public.is_trip_member(trip_id));

-- Items: accepted members may create
drop policy if exists "Members can create trip itinerary items" on public.trip_itinerary_items;
create policy "Members can create trip itinerary items"
  on public.trip_itinerary_items
  for insert
  with check (public.is_trip_member(trip_id) and auth.uid() = created_by);

-- Items: only the creator may edit their own item
drop policy if exists "Creator can update their own itinerary item" on public.trip_itinerary_items;
create policy "Creator can update their own itinerary item"
  on public.trip_itinerary_items
  for update
  using (auth.uid() = created_by);

-- Items: only the creator may delete their own item
drop policy if exists "Creator can delete their own itinerary item" on public.trip_itinerary_items;
create policy "Creator can delete their own itinerary item"
  on public.trip_itinerary_items
  for delete
  using (auth.uid() = created_by);

-- Reactions: accepted members may view
drop policy if exists "Members can view trip itinerary reactions" on public.trip_itinerary_reactions;
create policy "Members can view trip itinerary reactions"
  on public.trip_itinerary_reactions
  for select
  using (
    public.is_trip_member(
      (select trip_id from public.trip_itinerary_items where id = item_id)
    )
  );

-- Reactions: accepted members may insert their own reaction
drop policy if exists "Members can create their own itinerary reaction" on public.trip_itinerary_reactions;
create policy "Members can create their own itinerary reaction"
  on public.trip_itinerary_reactions
  for insert
  with check (
    auth.uid() = user_id
    and public.is_trip_member(
      (select trip_id from public.trip_itinerary_items where id = item_id)
    )
  );

-- Reactions: a user may update only their own reaction (like <-> dislike)
drop policy if exists "Users can update their own itinerary reaction" on public.trip_itinerary_reactions;
create policy "Users can update their own itinerary reaction"
  on public.trip_itinerary_reactions
  for update
  using (auth.uid() = user_id);

-- Reactions: a user may delete only their own reaction
drop policy if exists "Users can delete their own itinerary reaction" on public.trip_itinerary_reactions;
create policy "Users can delete their own itinerary reaction"
  on public.trip_itinerary_reactions
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. Grants (raw-SQL tables need explicit grants)
-- ------------------------------------------------------------
grant all on table public.trip_itinerary_items to authenticated;
grant all on table public.trip_itinerary_reactions to authenticated;

grant select on table public.trip_itinerary_items to anon;
grant select on table public.trip_itinerary_reactions to anon;

-- ------------------------------------------------------------
-- 7. Push trigger now forwards the deep-linking fields too.
--    Run the realtime_and_push.sql setup first (it creates the
--    notify_push_on_notification_insert function + trigger), then
--    re-run THIS block to upgrade it with trip_id / itinerary_item_id.
-- ------------------------------------------------------------
create or replace function public.notify_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := 'https://dbnlusdadoonuwezvina.supabase.co/functions/v1/send-push';
  v_body jsonb;
begin
  -- Wrap the push call so a failing Edge Function / pg_net never rolls back
  -- the notification insert itself.
  begin
    v_body := jsonb_build_object(
      'notification_id', new.id,
      'user_id', new.user_id,
      'actor_id', new.actor_id,
      'type', new.type,
      'title', new.title,
      'message', new.message,
      'trip_id', new.trip_id,
      'itinerary_item_id', new.itinerary_item_id
    );

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := v_body
    );
  exception when others then
    null; -- push is best-effort; the notification row must always be saved
  end;

  return new;
end;
$$;

drop trigger if exists notify_push_on_notification_insert_trigger on public.notifications;
create trigger notify_push_on_notification_insert_trigger
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_notification_insert();
