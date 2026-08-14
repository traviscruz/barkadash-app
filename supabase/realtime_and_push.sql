-- ============================================================================
-- Barkadash — Realtime + Push Notifications setup
-- Run this in the Supabase SQL Editor (public schema).
--
-- What this does:
--   1. Adds all tables to the realtime publication so the app receives live
--      changes (notifications, trips, participants, polls, votes, follows).
--   2. Creates the push_tokens table (device push token per user) + RLS.
--   3. Auto-finalizes trip polls once voting_deadline passes (pg_cron) and
--      writes "poll results" notifications for every accepted member.
--   4. Sends every inserted notification to the Expo push service via the
--      `send-push` Edge Function (pg_net trigger).
--
-- AFTER running this, you must deploy the Edge Function:
--     supabase functions deploy send-push --no-verify-jwt
-- (your Supabase project ref is the "dbnlusdadoonuwezvina" in your URL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable Realtime (must run so postgres_changes works on these tables)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_participants'
  ) then
    alter publication supabase_realtime add table public.trip_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_poll_options'
  ) then
    alter publication supabase_realtime add table public.trip_poll_options;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_poll_votes'
  ) then
    alter publication supabase_realtime add table public.trip_poll_votes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follows'
  ) then
    alter publication supabase_realtime add table public.follows;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. push_tokens table (one push token per user — last device wins)
-- ----------------------------------------------------------------------------
create table if not exists public.push_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can manage their own push token" on public.push_tokens;
create policy "Users can manage their own push token"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant all on table public.push_tokens to authenticated;

-- ----------------------------------------------------------------------------
-- 2b. Notifications — allow a user to delete their own notifications
--     (swipe-to-delete + delete all in the app).
-- ----------------------------------------------------------------------------
drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Auto-finalize polls when the voting deadline passes (pg_cron)
--    Writes a "Poll Results Are In!" notification for every accepted member.
-- ----------------------------------------------------------------------------
create or replace function public.finalize_expired_trip_polls()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_winner uuid;
  v_winner_title text;
  v_member record;
begin
  for r in
    select id, title, voting_deadline
    from public.trips
    where planning_stage = 'DESTINATION_VOTING'
      and voting_deadline is not null
      and voting_deadline < now()
  loop
    -- Place-poll winner (most votes, earliest proposal wins ties)
    select o.id, o.title into v_winner, v_winner_title
    from public.trip_poll_options o
    left join public.trip_poll_votes v on v.option_id = o.id
    where o.trip_id = r.id and o.type = 'place'
    group by o.id, o.title, o.created_at
    order by count(v.id) desc, o.created_at asc
    limit 1;

    update public.trips
    set destination = coalesce(v_winner_title, 'Voting in Progress'),
        planning_stage = 'ITINERARY_BUILDING',
        updated_at = now()
    where id = r.id;

    -- Notify every accepted member (host included)
    for v_member in
      select user_id
      from public.trip_participants
      where trip_id = r.id and status = 'accepted'
    loop
      insert into public.notifications (user_id, actor_id, type, title, message, is_read)
      values (
        v_member.user_id,
        (select host_id from public.trips where id = r.id),
        'poll_result',
        'Poll Results Are In!',
        case
          when v_winner is not null
            then format('The destination poll for "%s" has ended — "%s" won!', r.title, v_winner_title)
          else format('The destination poll for "%s" has ended with no clear winner.', r.title)
        end,
        false
      );
    end loop;

    v_winner := null;
    v_winner_title := null;
  end loop;
end;
$$;

grant execute on function public.finalize_expired_trip_polls() to authenticated;

-- pg_cron: run the finalizer every minute (idempotent — safe to re-run)
create extension if not exists pg_cron;
select cron.unschedule('finalize-trip-polls')
  where exists (select 1 from cron.job where jobname = 'finalize-trip-polls');
select cron.schedule('finalize-trip-polls', '* * * * *', $$ select public.finalize_expired_trip_polls(); $$);

-- ----------------------------------------------------------------------------
-- 4. Push trigger — forward every notification insert to the Edge Function,
--    which sends it to the recipient's device via the Expo push service.
-- ----------------------------------------------------------------------------
create extension if not exists pg_net;

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
  v_body := jsonb_build_object(
    'notification_id', new.id,
    'user_id', new.user_id,
    'actor_id', new.actor_id,
    'type', new.type,
    'title', new.title,
    'message', new.message
  );

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_body
  );

  return new;
end;
$$;

drop trigger if exists notify_push_on_notification_insert_trigger on public.notifications;
create trigger notify_push_on_notification_insert_trigger
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_notification_insert();
