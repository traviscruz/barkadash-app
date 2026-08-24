what -- ============================================================
-- Barkadash — Where You'll Stay (Host-picked Accommodations)
-- Run this in the Supabase SQL Editor (public schema).
--
-- Depends on: is_trip_member(uuid) from trip_polls.sql
--
-- What this adds:
--   1. trip_stays            — accommodations the HOST picks for the trip
--      (Google Places lookup OR manual, nights to stay, link, note)
--   2. trip_stay_reactions   — like / dislike per stay, one per user
--   3. trip_stay_comments    — member comments per stay
--   4. is_trip_host(uuid)    — helper: is the current user the trip host?
--   5. RLS
--        · Members can VIEW stays, reactions, comments
--        · ONLY the host can add/edit/delete stays, and stays can ONLY be
--          added once the tour is LOCKED (place & dates finalized →
--          planning_stage in READY / ITINERARY_BUILDING)
--        · Members can react / comment
--   6. Realtime publication for the three new tables
--   7. notifications.stay_id deep-link column + push trigger upgrade
--   8. Grants
-- ============================================================

-- ------------------------------------------------------------
-- 1. Stays table (host-picked accommodation per trip)
--    start_day / end_day are 1-based DAY NUMBERS that map to the
--    trip's locked date range (e.g. stay Day 1–3 of a 4-day trip),
--    so a trip can have several stays (hotel + airbnb, etc.).
-- ------------------------------------------------------------
create table if not exists public.trip_stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  start_day integer not null default 1 check (start_day >= 1),
  end_day integer not null default 1 check (end_day >= 1),
  place_id text,
  place_name text,
  place_address text,
  photo_reference text,
  link text,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_stays_end_day_gte_start_day check (end_day >= start_day)
);

create index if not exists trip_stays_trip_id_idx
  on public.trip_stays(trip_id);

create index if not exists trip_stays_created_by_idx
  on public.trip_stays(created_by);

-- ------------------------------------------------------------
-- 2. Reactions table (one reaction per (stay, user) — like or dislike)
-- ------------------------------------------------------------
create table if not exists public.trip_stay_reactions (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.trip_stays(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_stay_reactions_stay_user_key unique (stay_id, user_id)
);

create index if not exists trip_stay_reactions_stay_id_idx
  on public.trip_stay_reactions(stay_id);

create index if not exists trip_stay_reactions_user_id_idx
  on public.trip_stay_reactions(user_id);

-- ------------------------------------------------------------
-- 3. Comments table (member comments per stay)
-- ------------------------------------------------------------
create table if not exists public.trip_stay_comments (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.trip_stays(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  comment text not null check (char_length(trim(comment)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists trip_stay_comments_stay_id_idx
  on public.trip_stay_comments(stay_id);

-- ------------------------------------------------------------
-- 4. Helper: is the current user the host of a trip?
-- ------------------------------------------------------------
create or replace function public.is_trip_host(trip_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips
    where id = trip_uuid
      and host_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 5. Notifications deep-linking column (stay_id)
-- ------------------------------------------------------------
alter table public.notifications
  add column if not exists stay_id uuid
  references public.trip_stays(id) on delete set null;

-- ------------------------------------------------------------
-- 6. Realtime (so stays/reactions/comments update live for everyone)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_stays'
  ) then
    alter publication supabase_realtime add table public.trip_stays;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_stay_reactions'
  ) then
    alter publication supabase_realtime add table public.trip_stay_reactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_stay_comments'
  ) then
    alter publication supabase_realtime add table public.trip_stay_comments;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------------------
alter table public.trip_stays          enable row level security;
alter table public.trip_stay_reactions enable row level security;
alter table public.trip_stay_comments  enable row level security;

-- Stays: accepted members may view
drop policy if exists "Members can view trip stays" on public.trip_stays;
create policy "Members can view trip stays"
  on public.trip_stays
  for select
  using (public.is_trip_member(trip_id));

-- Stays: ONLY the host may add one, and ONLY once the tour is locked in
-- (place & dates finalized → READY / ITINERARY_BUILDING).
drop policy if exists "Host can create trip stays (tour locked)" on public.trip_stays;
create policy "Host can create trip stays (tour locked)"
  on public.trip_stays
  for insert
  with check (
    auth.uid() = created_by
    and public.is_trip_host(trip_id)
    and exists (
      select 1 from public.trips
      where id = trip_id
        and planning_stage in ('READY', 'ITINERARY_BUILDING')
    )
  );

-- Stays: only the host may edit their stays
drop policy if exists "Host can update trip stays" on public.trip_stays;
create policy "Host can update trip stays"
  on public.trip_stays
  for update
  using (public.is_trip_host(trip_id));

-- Stays: only the host may delete their stays
drop policy if exists "Host can delete trip stays" on public.trip_stays;
create policy "Host can delete trip stays"
  on public.trip_stays
  for delete
  using (public.is_trip_host(trip_id));

-- Reactions: accepted members may view
drop policy if exists "Members can view trip stay reactions" on public.trip_stay_reactions;
create policy "Members can view trip stay reactions"
  on public.trip_stay_reactions
  for select
  using (
    public.is_trip_member(
      (select trip_id from public.trip_stays where id = stay_id)
    )
  );

-- Reactions: accepted members may insert their own reaction
drop policy if exists "Members can create their own stay reaction" on public.trip_stay_reactions;
create policy "Members can create their own stay reaction"
  on public.trip_stay_reactions
  for insert
  with check (
    auth.uid() = user_id
    and public.is_trip_member(
      (select trip_id from public.trip_stays where id = stay_id)
    )
  );

-- Reactions: a user may update only their own reaction (like <-> dislike)
drop policy if exists "Users can update their own stay reaction" on public.trip_stay_reactions;
create policy "Users can update their own stay reaction"
  on public.trip_stay_reactions
  for update
  using (auth.uid() = user_id);

-- Reactions: a user may delete only their own reaction
drop policy if exists "Users can delete their own stay reaction" on public.trip_stay_reactions;
create policy "Users can delete their own stay reaction"
  on public.trip_stay_reactions
  for delete
  using (auth.uid() = user_id);

-- Comments: accepted members may view
drop policy if exists "Members can view trip stay comments" on public.trip_stay_comments;
create policy "Members can view trip stay comments"
  on public.trip_stay_comments
  for select
  using (
    public.is_trip_member(
      (select trip_id from public.trip_stays where id = stay_id)
    )
  );

-- Comments: accepted members may insert their own comment
drop policy if exists "Members can create their own stay comment" on public.trip_stay_comments;
create policy "Members can create their own stay comment"
  on public.trip_stay_comments
  for insert
  with check (
    auth.uid() = user_id
    and public.is_trip_member(
      (select trip_id from public.trip_stays where id = stay_id)
    )
  );

-- Comments: a user may update only their own comment
drop policy if exists "Users can update their own stay comment" on public.trip_stay_comments;
create policy "Users can update their own stay comment"
  on public.trip_stay_comments
  for update
  using (auth.uid() = user_id);

-- Comments: a user may delete only their own comment
drop policy if exists "Users can delete their own stay comment" on public.trip_stay_comments;
create policy "Users can delete their own stay comment"
  on public.trip_stay_comments
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 8. Grants (raw-SQL tables need explicit grants)
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant all on table public.trip_stays          to authenticated;
grant all on table public.trip_stay_reactions to authenticated;
grant all on table public.trip_stay_comments  to authenticated;

grant select on table public.trip_stays          to anon;
grant select on table public.trip_stay_reactions to anon;
grant select on table public.trip_stay_comments  to anon;

grant execute on function public.is_trip_host(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 9. Push trigger now forwards the stay deep-linking field too.
--    Run stays.sql AFTER realtime_and_push.sql / itinerary.sql, then
--    re-run THIS block to upgrade it with stay_id.
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
      'itinerary_item_id', new.itinerary_item_id,
      'stay_id', new.stay_id
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