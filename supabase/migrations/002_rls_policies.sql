-- 002_rls_policies.sql — Data API grants + Row Level Security for every table created in 001.
--
-- Two independent layers:
--   1. GRANTs decide whether a Data API role may touch a table at all.
--   2. RLS policies decide which rows it may see or write.
-- Grants are explicit and minimal so the local stack (which still auto-exposes new public tables) and hosted
-- projects (no automatic grants for new tables from 2026-05-30 for new projects, 2026-10-30 for all) behave
-- the same. Roles: anon = publishable key without a session, authenticated = signed-in user,
-- service_role = secret key (bypasses RLS; Edge Functions and test tooling only, never the browser).

-- ---------------------------------------------------------------------------
-- 1. Grants
-- ---------------------------------------------------------------------------
-- Normalize first: drop whatever default privileges handed out (incl. TRUNCATE, which RLS cannot restrict).
revoke all on table
  public.profiles, public.food_items, public.meal_logs, public.weight_logs,
  public.workout_logs, public.scheduled_workouts, public.favorites, public.saved_meals
from anon, authenticated, service_role;

-- Signed-in users: CRUD on their own data (RLS below limits the rows).
grant select, insert, update, delete on table
  public.profiles, public.meal_logs, public.weight_logs, public.workout_logs,
  public.scheduled_workouts, public.favorites, public.saved_meals
to authenticated;
-- food_items: read the system catalog + own foods; write own custom/saved foods only (RLS).
grant select, insert, update, delete on table public.food_items to authenticated;

-- Without a session the shared system catalog is readable (RLS limits anon to created_by is null).
grant select on table public.food_items to anon;

-- Secret key (server-side only).
grant select, insert, update, delete on table
  public.profiles, public.food_items, public.meal_logs, public.weight_logs,
  public.workout_logs, public.scheduled_workouts, public.favorites, public.saved_meals
to service_role;

-- Functions. Postgres checks EXECUTE on functions used in CHECK constraints as the inserting role, so
-- is_valid_nutrient_map stays executable for every role that writes food_items / meal_logs.
revoke execute on function public.is_valid_nutrient_map(jsonb) from public, anon;
grant execute on function public.is_valid_nutrient_map(jsonb) to authenticated, service_role;
-- Trigger function: fired by the table triggers, never called directly.
revoke execute on function public.guard_stale_write() from public, anon, authenticated, service_role;

-- Future objects created by migrations (role postgres) in public get no automatic Data API access, matching
-- hosted projects: every new table / function must GRANT explicitly in its own migration.
-- (EXECUTE for PUBLIC on new functions is a global Postgres default that a per-schema rule cannot remove,
-- so a new function must still `revoke execute ... from public` itself.)
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Row Level Security: deny by default once enabled.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.food_items enable row level security;
alter table public.meal_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.favorites enable row level security;
alter table public.saved_meals enable row level security;

-- Policies use (select auth.uid()) so Postgres evaluates it once per statement (initPlan), not per row.
-- UPDATE policies repeat the owner condition in WITH CHECK: ownership can never be reassigned.

-- ---------------------------------------------------------------------------
-- profiles (PK id = auth.users.id)
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- food_items: system catalog (created_by is null) is read-only for everyone; custom / saved provider
-- foods are private to their creator. There is no client write path for system rows.
-- ---------------------------------------------------------------------------
-- One SELECT policy per role (two permissive policies for the same role/action would both run per row).
create policy food_items_select_system on public.food_items
  for select to anon using (created_by is null);
create policy food_items_select_visible on public.food_items
  for select to authenticated using (created_by is null or created_by = (select auth.uid()));
create policy food_items_insert_own on public.food_items
  for insert to authenticated
  with check (created_by = (select auth.uid()) and source <> 'system');
create policy food_items_update_own on public.food_items
  for update to authenticated
  using (created_by = (select auth.uid()) and source <> 'system')
  with check (created_by = (select auth.uid()) and source <> 'system');
create policy food_items_delete_own on public.food_items
  for delete to authenticated using (created_by = (select auth.uid()) and source <> 'system');

-- ---------------------------------------------------------------------------
-- meal_logs: own rows; a referenced food must be visible to the user (system or own).
-- ---------------------------------------------------------------------------
create policy meal_logs_select_own on public.meal_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_logs_insert_own on public.meal_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      meal_logs.food_id is null
      or exists (
        select 1 from public.food_items f
        where f.id = meal_logs.food_id and (f.created_by is null or f.created_by = (select auth.uid()))
      )
    )
  );
create policy meal_logs_update_own on public.meal_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      meal_logs.food_id is null
      or exists (
        select 1 from public.food_items f
        where f.id = meal_logs.food_id and (f.created_by is null or f.created_by = (select auth.uid()))
      )
    )
  );
create policy meal_logs_delete_own on public.meal_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- weight_logs, workout_logs, scheduled_workouts, saved_meals: own rows only.
-- ---------------------------------------------------------------------------
create policy weight_logs_select_own on public.weight_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy weight_logs_insert_own on public.weight_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy weight_logs_update_own on public.weight_logs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy weight_logs_delete_own on public.weight_logs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy workout_logs_select_own on public.workout_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy workout_logs_insert_own on public.workout_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_logs_update_own on public.workout_logs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_logs_delete_own on public.workout_logs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy scheduled_workouts_select_own on public.scheduled_workouts
  for select to authenticated using (user_id = (select auth.uid()));
create policy scheduled_workouts_insert_own on public.scheduled_workouts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy scheduled_workouts_update_own on public.scheduled_workouts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy scheduled_workouts_delete_own on public.scheduled_workouts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy saved_meals_select_own on public.saved_meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy saved_meals_insert_own on public.saved_meals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_meals_update_own on public.saved_meals
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_meals_delete_own on public.saved_meals
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- favorites: own rows; the favorited food must be visible to the user (system or own).
-- ---------------------------------------------------------------------------
create policy favorites_select_own on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.food_items f
      where f.id = favorites.food_id and (f.created_by is null or f.created_by = (select auth.uid()))
    )
  );
create policy favorites_update_own on public.favorites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.food_items f
      where f.id = favorites.food_id and (f.created_by is null or f.created_by = (select auth.uid()))
    )
  );
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));
