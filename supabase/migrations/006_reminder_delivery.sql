-- 006_reminder_delivery.sql — scheduled email reminder delivery.
--
-- Every 5 minutes pg_cron calls private.invoke_reminders(), which POSTs to the `reminders` Edge Function
-- (pg_net). The function claims due reminders with public.claim_due_reminders() (service role only), sends the
-- emails and records the outcome on each reminder_dispatches row. The (schedule, local day) unique key makes
-- delivery idempotent: a reminder is claimed once per day even when runs overlap or are retried.
--
-- The function URL and the shared secret live in Supabase Vault (never in migrations):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/reminders/dispatch', 'reminders_dispatch_url');
--   select vault.create_secret('<random secret>', 'reminders_cron_secret');   -- same value as the function secret
-- Without them (e.g. a fresh local stack) the job does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Claiming due reminders
-- ---------------------------------------------------------------------------
-- A schedule is due on a local day D (in its own time zone) when D is one of its weekdays and the local time
-- is within [local_time, local_time + window). Yesterday is checked too, so 23:55 reminders still go out when
-- the run happens just after midnight. Returns the claimed dispatches with what the email needs.
create or replace function public.claim_due_reminders(
  p_now timestamptz default now(),
  p_window_minutes integer default 15,
  p_limit integer default 200
)
returns table (
  dispatch_id uuid,
  schedule_id uuid,
  user_id uuid,
  email text,
  kind text,
  meal_type text,
  local_date date,
  local_time time,
  timezone text,
  skip_if_logged boolean,
  already_logged boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_dispatches (schedule_id, user_id, local_date, due_at)
  select s.id, s.user_id, d.local_date, (d.local_date + s.local_time) at time zone s.timezone
  from public.reminder_schedules s
  cross join lateral (select p_now at time zone s.timezone as local_now) n
  cross join lateral (values (n.local_now::date), (n.local_now::date - 1)) as d (local_date)
  where s.enabled
    and extract(dow from d.local_date)::smallint = any (s.days)
    and n.local_now >= d.local_date + s.local_time
    and n.local_now < d.local_date + s.local_time + make_interval(mins => p_window_minutes)
  on conflict on constraint reminder_dispatches_schedule_id_local_date_key do nothing;

  return query
  with claimable as (
    select r.id
    from public.reminder_dispatches r
    -- New rows; failed attempts and runs that died mid-send (claimed > 10 min ago) are retried, but only up
    -- to 3 attempts and while the reminder is still timely (an hour with the default 15-minute window).
    where r.status = 'pending'
       or (r.attempts < 3 and r.due_at > p_now - make_interval(mins => p_window_minutes * 4) and (
             r.status = 'failed' or (r.status = 'claimed' and r.updated_at < p_now - interval '10 minutes')))
    order by r.due_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.reminder_dispatches r
    set status = 'claimed', attempts = r.attempts + 1, updated_at = p_now
    from claimable c
    where r.id = c.id
    returning r.id, r.schedule_id, r.user_id, r.local_date
  )
  select c.id, c.schedule_id, c.user_id, u.email::text, s.kind, s.meal_type, c.local_date, s.local_time::time,
    s.timezone, s.skip_if_logged,
    s.kind = 'meal_log' and exists (
      select 1 from public.meal_logs m
      where m.user_id = c.user_id and m.log_date = c.local_date and m.meal_type = s.meal_type
    )
  from claimed c
  join public.reminder_schedules s on s.id = c.schedule_id
  join auth.users u on u.id = c.user_id;
end;
$$;
revoke execute on function public.claim_due_reminders(timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(timestamptz, integer, integer) to service_role;

-- Delivery updates are announced like user writes (004), so an open app shows "sent" right away.
create trigger reminder_dispatches_notify_change after insert or update on public.reminder_dispatches
  for each row execute function private.notify_user_change();

-- ---------------------------------------------------------------------------
-- Scheduler (pg_cron → pg_net → Edge Function)
-- ---------------------------------------------------------------------------
create or replace function private.invoke_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text;
  secret text;
begin
  select decrypted_secret into target from vault.decrypted_secrets where name = 'reminders_dispatch_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'reminders_cron_secret';
  if target is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := target,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reminders-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function private.invoke_reminders() from public, anon, authenticated, service_role;

-- Housekeeping: old delivery rows and tombstones (004) are not needed forever.
create or replace function private.prune_sync_history()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.reminder_dispatches where due_at < now() - interval '60 days';
  delete from private.sync_tombstones where deleted_at < now() - interval '90 days';
$$;
revoke execute on function private.prune_sync_history() from public, anon, authenticated, service_role;

select cron.schedule('dispatch-reminders', '*/5 * * * *', 'select private.invoke_reminders()');
select cron.schedule('prune-sync-history', '17 3 * * *', 'select private.prune_sync_history()');
