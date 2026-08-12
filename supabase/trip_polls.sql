-- ============================================================
-- Barkadash — Trip Voting Polls (Places & Dates)
-- Run this in the Supabase SQL Editor (public schema).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Voting deadline column on trips (host-set deadline)
-- ------------------------------------------------------------
alter table public.trips
  add column if not exists voting_deadline timestamptz;

-- ------------------------------------------------------------
-- 2. Poll options table (place or date-range proposals)
-- ------------------------------------------------------------
create table if not exists public.trip_poll_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  type text not null check (type in ('place', 'date')),
  title text not null,
  subtitle text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_poll_options_trip_id_idx
  on public.trip_poll_options(trip_id);

-- ------------------------------------------------------------
-- 2b. Google Places metadata for place proposals
--     (place_id + cover photo from the Google Places API).
-- ------------------------------------------------------------
alter table public.trip_poll_options
  add column if not exists place_id text;
alter table public.trip_poll_options
  add column if not exists place_name text;
alter table public.trip_poll_options
  add column if not exists place_address text;
alter table public.trip_poll_options
  add column if not exists photo_reference text;

-- ------------------------------------------------------------
-- 3. Votes table (one vote per (option, user), enforced at DB)
-- ------------------------------------------------------------
create table if not exists public.trip_poll_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.trip_poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint trip_poll_votes_option_user_key unique (option_id, user_id)
);

create index if not exists trip_poll_votes_option_id_idx
  on public.trip_poll_votes(option_id);

create index if not exists trip_poll_votes_user_id_idx
  on public.trip_poll_votes(user_id);

-- ------------------------------------------------------------
-- 4. Helper: is the current user an accepted member of a trip?
-- ------------------------------------------------------------
create or replace function public.is_trip_member(trip_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_participants
    where trip_id = trip_uuid
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;

-- ------------------------------------------------------------
-- 5. One-vote-only enforcement per SECTION.
--    A member may vote for one option per type (place AND date
--    are independent polls); voting moves their vote within the
--    same section only.
-- ------------------------------------------------------------
create or replace function public.enforce_single_trip_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_type text;
  v_existing_id uuid;
begin
  select trip_id, type into v_trip_id, v_type
  from public.trip_poll_options
  where id = new.option_id;

  if v_trip_id is null then
    raise exception 'Poll option does not exist';
  end if;

  -- Remove any previous vote the user cast on another option of the
  -- SAME type (section) within the same trip
  select v.id into v_existing_id
  from public.trip_poll_votes v
  join public.trip_poll_options o on o.id = v.option_id
  where v.user_id = new.user_id
    and o.trip_id = v_trip_id
    and o.type = v_type
    and v.option_id <> new.option_id
  limit 1;

  if v_existing_id is not null then
    delete from public.trip_poll_votes where id = v_existing_id;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_single_trip_vote_trigger on public.trip_poll_votes;
create trigger enforce_single_trip_vote_trigger
  before insert on public.trip_poll_votes
  for each row
  execute function public.enforce_single_trip_vote();

-- ------------------------------------------------------------
-- 6. Row Level Security
-- ------------------------------------------------------------
-- Trips: accepted members may view; the host may update the trip
-- (e.g. set the voting deadline).
alter table public.trips enable row level security;

drop policy if exists "Members can view trips" on public.trips;
create policy "Members can view trips"
  on public.trips
  for select
  using (auth.uid() = host_id or public.is_trip_member(id));

drop policy if exists "Host can update their trip" on public.trips;
create policy "Host can update their trip"
  on public.trips
  for update
  using (auth.uid() = host_id);

drop policy if exists "Host can delete their trip" on public.trips;
create policy "Host can delete their trip"
  on public.trips
  for delete
  using (auth.uid() = host_id);

-- Trip participants: members may view the roster; a user may insert
-- themselves (join / accept invite); the host may add/update/kick members.
alter table public.trip_participants enable row level security;

drop policy if exists "Members can view trip participants" on public.trip_participants;
create policy "Members can view trip participants"
  on public.trip_participants
  for select
  using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists "Users can join or host can add members" on public.trip_participants;
create policy "Users can join or host can add members"
  on public.trip_participants
  for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.trips where id = trip_id and host_id = auth.uid())
  );

drop policy if exists "Users can leave or host can kick members" on public.trip_participants;
create policy "Users can leave or host can kick members"
  on public.trip_participants
  for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.trips where id = trip_id and host_id = auth.uid())
  );

drop policy if exists "Host can update trip participants" on public.trip_participants;
create policy "Host can update trip participants"
  on public.trip_participants
  for update
  using (exists (select 1 from public.trips where id = trip_id and host_id = auth.uid()));

alter table public.trip_poll_options enable row level security;
alter table public.trip_poll_votes  enable row level security;

-- Options: only accepted trip members may SELECT
drop policy if exists "Members can view trip poll options" on public.trip_poll_options;
create policy "Members can view trip poll options"
  on public.trip_poll_options
  for select
  using (public.is_trip_member(trip_id));

-- Options: only accepted trip members may INSERT
drop policy if exists "Members can create trip poll options" on public.trip_poll_options;
create policy "Members can create trip poll options"
  on public.trip_poll_options
  for insert
  with check (public.is_trip_member(trip_id) and auth.uid() = created_by);

-- Options: only the creator may UPDATE their own option
drop policy if exists "Creator can update their own trip poll option" on public.trip_poll_options;
create policy "Creator can update their own trip poll option"
  on public.trip_poll_options
  for update
  using (auth.uid() = created_by);

-- Options: only the creator may DELETE their own option
drop policy if exists "Creator can delete their own trip poll option" on public.trip_poll_options;
create policy "Creator can delete their own trip poll option"
  on public.trip_poll_options
  for delete
  using (auth.uid() = created_by);

-- Votes: only accepted trip members may SELECT
drop policy if exists "Members can view trip poll votes" on public.trip_poll_votes;
create policy "Members can view trip poll votes"
  on public.trip_poll_votes
  for select
  using (
    public.is_trip_member(
      (select trip_id from public.trip_poll_options where id = option_id)
    )
  );

-- Votes: only accepted members may INSERT their own vote
drop policy if exists "Members can create their own vote" on public.trip_poll_votes;
create policy "Members can create their own vote"
  on public.trip_poll_votes
  for insert
  with check (
    public.is_trip_member(
      (select trip_id from public.trip_poll_options where id = option_id)
    )
    and auth.uid() = user_id
  );

-- Votes: a user may DELETE only their own vote
drop policy if exists "Users can delete their own votes" on public.trip_poll_votes;
create policy "Users can delete their own votes"
  on public.trip_poll_votes
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. Privileges (required! raw-SQL tables are NOT auto-granted)
--    Without these grants the app gets "permission denied for
--    table trip_poll_options" even when RLS policies allow it.
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant all on table public.trip_poll_options to authenticated;
grant all on table public.trip_poll_votes  to authenticated;
grant all on table public.trip_participants to authenticated;
grant select, update, delete on table public.trips to authenticated;

grant select on table public.trip_poll_options to anon;
grant select on table public.trip_poll_votes  to anon;
grant select on table public.trip_participants to anon;

grant execute on function public.is_trip_member(uuid) to anon, authenticated;
grant execute on function public.enforce_single_trip_vote() to authenticated;