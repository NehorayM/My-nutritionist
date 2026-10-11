-- 004_sync_integrity.sql — delete tombstones and change notifications for multi-device sync.
--
-- 1. Tombstones. Deleting a row records the version it had (old.updated_at). Re-inserting the same id is then
--    accepted only with a NEWER version — e.g. Undo, which saves the record again with a fresh timestamp —
--    so an older queued change from another device can never bring a deleted record back. The client sees
--    the skipped insert (no row returned, no current row) and removes its local copy.
-- 2. Change notifications. Every write to a user table sends a tiny Realtime broadcast ("which table changed")
--    on the private topic 'user:<owner id>'. Signed-in clients subscribe to their own topic only (policy on
--    realtime.messages below) and reload what changed — no row data is ever broadcast.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Tombstones
-- ---------------------------------------------------------------------------
create table private.sync_tombstones (
  table_name text not null,
  record_id uuid not null,
  user_id uuid not null,
  deleted_version timestamptz not null,
  deleted_at timestamptz not null default now(),
  primary key (table_name, record_id)
);
comment on table private.sync_tombstones is
  'Last deleted version per (table, id); inserts of that id must be newer. Pruned after 90 days.';
alter table private.sync_tombstones enable row level security;
revoke all on table private.sync_tombstones from public, anon, authenticated, service_role;

-- Owner of a row of any user table (profiles are keyed by the user; foods by created_by).
create or replace function private.row_owner(tbl text, rec jsonb)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case tbl
    when 'profiles' then (rec ->> 'id')::uuid
    when 'food_items' then (rec ->> 'created_by')::uuid
    else (rec ->> 'user_id')::uuid
  end
$$;

create or replace function private.record_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := private.row_owner(tg_table_name, to_jsonb(old));
begin
  -- Rows removed because their user was deleted (cascade) need no tombstone.
  if owner is null or not exists (select 1 from auth.users where id = owner) then
    return old;
  end if;
  insert into private.sync_tombstones as t (table_name, record_id, user_id, deleted_version)
  values (tg_table_name, (to_jsonb(old) ->> 'id')::uuid, owner, old.updated_at)
  on conflict (table_name, record_id) do update
    set deleted_version = greatest(t.deleted_version, excluded.deleted_version), deleted_at = now();
  return old;
end;
$$;

-- Stale-write guard (see 001), now also rejecting inserts of deleted records with an old version.
-- SECURITY DEFINER so it can read the tombstones, which no API role can access directly.
create or replace function public.guard_stale_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.updated_at is null or new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  elsif exists (
    select 1 from private.sync_tombstones t
    where t.table_name = tg_table_name
      and t.record_id = (to_jsonb(new) ->> 'id')::uuid
      and t.deleted_version >= new.updated_at
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_stale_write() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Change notifications (Realtime broadcast from the database)
-- ---------------------------------------------------------------------------
create or replace function private.notify_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  owner uuid := private.row_owner(tg_table_name, rec);
begin
  if owner is not null then
    begin
      perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'user:' || owner::text, true);
    exception when others then
      -- Notifications are best effort: a Realtime problem must never fail the user's write.
      null;
    end;
  end if;
  return null;
end;
$$;

revoke execute on function private.row_owner(text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function private.record_tombstone() from public, anon, authenticated, service_role;
revoke execute on function private.notify_user_change() from public, anon, authenticated, service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'food_items', 'meal_logs', 'weight_logs', 'workout_logs', 'scheduled_workouts', 'favorites', 'saved_meals'
  ] loop
    execute format(
      'create trigger %I after delete on public.%I for each row execute function private.record_tombstone()',
      tbl || '_tombstone', tbl);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.notify_user_change()',
      tbl || '_notify_change', tbl);
  end loop;
end;
$$;

-- System foods (created_by is null) have no owner topic; notify_user_change skips them.

-- Signed-in users may receive broadcasts on their own topic only; nobody may send through the API.
create policy user_topic_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
