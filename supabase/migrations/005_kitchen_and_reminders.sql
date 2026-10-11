-- 005_kitchen_and_reminders.sql — pantry inventory, meal-planner settings and email reminder schedules.
--
-- pantry_items / planner_settings / reminder_schedules are user-owned and synchronized like the tables of 001
-- (client UUIDs, stale-write guard, tombstones and change notifications from 004, RLS: own rows only).
-- reminder_dispatches is written only by the server (service role, the `reminders` Edge Function); users may
-- read their own rows to see when a reminder was last sent.

-- ---------------------------------------------------------------------------
-- pantry_items — what the user has at home, with how it is eaten
-- ---------------------------------------------------------------------------
create table public.pantry_items (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Snapshot of the food (catalog, own or provider food): name, nutrients per 100 g, servings, allergens…
  food jsonb not null check (jsonb_typeof(food) = 'object' and pg_column_size(food) <= 32768),
  -- Grams available; null = "some" (the amount is not tracked).
  grams numeric(8, 1) check (grams > 0 and grams <= 100000),
  serving_label text check (char_length(serving_label) <= 80),
  serving_grams numeric(7, 2) check (serving_grams > 0 and serving_grams <= 5000),
  prep text not null check (prep in ('ready', 'reheat', 'cook')),
  cook_minutes smallint check (cook_minutes between 1 and 600),
  methods text[] not null default '{}' check (methods <@ array['microwave', 'stove', 'oven']::text[]),
  use_by date check (use_by between date '2000-01-01' and date '2100-01-01'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pantry_items_cook_minutes check ((prep = 'cook') = (cook_minutes is not null)),
  constraint pantry_items_methods check (prep = 'ready' or cardinality(methods) > 0)
);
create index pantry_items_user_id_idx on public.pantry_items (user_id);

-- ---------------------------------------------------------------------------
-- planner_settings — kitchen and calorie constraints for meal planning (1:1 with the user)
-- ---------------------------------------------------------------------------
create table public.planner_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  equipment_scope text not null default 'day' check (equipment_scope in ('day', 'meal')),
  day_equipment text[] not null default '{}' check (day_equipment <@ array['microwave', 'stove', 'oven']::text[]),
  daily_kcal_min smallint check (daily_kcal_min between 500 and 6000),
  daily_kcal_max smallint check (daily_kcal_max between 500 and 6000),
  -- Per meal: {"breakfast": {"enabled", "equipment", "canCook", "maxMinutes", "kcalMin", "kcalMax"}, …}
  meals jsonb not null check (jsonb_typeof(meals) = 'object' and pg_column_size(meals) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_settings_daily_range check (daily_kcal_min is null or daily_kcal_max is null or daily_kcal_min <= daily_kcal_max)
);

-- ---------------------------------------------------------------------------
-- reminder_schedules — when to send which email reminder (signed-in users)
-- ---------------------------------------------------------------------------
create table public.reminder_schedules (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meal_log', 'hydration', 'planning', 'weigh_in')),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  local_time time(0) not null,
  -- Days of the week in the user's time zone, 0 = Sunday … 6 = Saturday.
  days smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  timezone text not null check (char_length(timezone) between 1 and 64),
  enabled boolean not null default true,
  -- Meal reminders: skip the email when that meal is already logged for the day.
  skip_if_logged boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_schedules_meal check ((kind = 'meal_log') = (meal_type is not null))
);
create index reminder_schedules_user_id_idx on public.reminder_schedules (user_id);
create index reminder_schedules_enabled_idx on public.reminder_schedules (enabled) where enabled;

-- Time zones must be real IANA names; at most 24 schedules per user.
create or replace function private.validate_reminder_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.reminder_schedules where user_id = new.user_id) >= 24 then
    raise exception 'too many reminders' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.validate_reminder_schedule() from public, anon, authenticated, service_role;
create trigger reminder_schedules_validate before insert or update on public.reminder_schedules
  for each row execute function private.validate_reminder_schedule();

-- ---------------------------------------------------------------------------
-- reminder_dispatches — one row per schedule and local day (idempotent delivery log)
-- ---------------------------------------------------------------------------
create table public.reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.reminder_schedules (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'sent', 'skipped', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  detail text check (char_length(detail) <= 200),
  provider_message_id text check (char_length(provider_message_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, local_date)
);
create index reminder_dispatches_user_id_idx on public.reminder_dispatches (user_id, due_at desc);
create index reminder_dispatches_open_idx on public.reminder_dispatches (status, due_at) where status in ('pending', 'claimed', 'failed');

-- ---------------------------------------------------------------------------
-- Sync integration (004): stale-write guard, tombstones, change notifications
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['pantry_items', 'planner_settings', 'reminder_schedules'] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.guard_stale_write()',
      tbl || '_guard_stale_write', tbl);
    execute format(
      'create trigger %I after delete on public.%I for each row execute function private.record_tombstone()',
      tbl || '_tombstone', tbl);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.notify_user_change()',
      tbl || '_notify_change', tbl);
  end loop;
end;
$$;

-- row_owner (004) knows profiles and food_items; planner_settings is keyed by the user like profiles.
create or replace function private.row_owner(tbl text, rec jsonb)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case tbl
    when 'profiles' then (rec ->> 'id')::uuid
    when 'planner_settings' then (rec ->> 'id')::uuid
    when 'food_items' then (rec ->> 'created_by')::uuid
    else (rec ->> 'user_id')::uuid
  end
$$;
revoke execute on function private.row_owner(text, jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants (explicit, see 002) and Row Level Security
-- ---------------------------------------------------------------------------
revoke all on table public.pantry_items, public.planner_settings, public.reminder_schedules, public.reminder_dispatches
  from anon, authenticated, service_role;
grant select, insert, update, delete on table public.pantry_items, public.planner_settings, public.reminder_schedules
  to authenticated;
grant select on table public.reminder_dispatches to authenticated;
grant select, insert, update, delete on table
  public.pantry_items, public.planner_settings, public.reminder_schedules, public.reminder_dispatches
  to service_role;

alter table public.pantry_items enable row level security;
alter table public.planner_settings enable row level security;
alter table public.reminder_schedules enable row level security;
alter table public.reminder_dispatches enable row level security;

create policy pantry_items_select_own on public.pantry_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy pantry_items_insert_own on public.pantry_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy pantry_items_update_own on public.pantry_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy pantry_items_delete_own on public.pantry_items
  for delete to authenticated using (user_id = (select auth.uid()));

create policy planner_settings_select_own on public.planner_settings
  for select to authenticated using (id = (select auth.uid()));
create policy planner_settings_insert_own on public.planner_settings
  for insert to authenticated with check (id = (select auth.uid()));
create policy planner_settings_update_own on public.planner_settings
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy planner_settings_delete_own on public.planner_settings
  for delete to authenticated using (id = (select auth.uid()));

create policy reminder_schedules_select_own on public.reminder_schedules
  for select to authenticated using (user_id = (select auth.uid()));
create policy reminder_schedules_insert_own on public.reminder_schedules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy reminder_schedules_update_own on public.reminder_schedules
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminder_schedules_delete_own on public.reminder_schedules
  for delete to authenticated using (user_id = (select auth.uid()));

-- Dispatches: read-only for their owner; only the service role writes them.
create policy reminder_dispatches_select_own on public.reminder_dispatches
  for select to authenticated using (user_id = (select auth.uid()));
