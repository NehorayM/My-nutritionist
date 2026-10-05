-- pgTAP: Row Level Security is enabled on every table and exactly the expected policies exist.
-- Run with `npx supabase test db` (local stack). Everything happens in one transaction that is rolled back.
begin;
select plan(20);

-- RLS enabled ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS enabled on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.food_items'::regclass), 'RLS enabled on food_items');
select ok((select relrowsecurity from pg_class where oid = 'public.meal_logs'::regclass), 'RLS enabled on meal_logs');
select ok((select relrowsecurity from pg_class where oid = 'public.weight_logs'::regclass), 'RLS enabled on weight_logs');
select ok((select relrowsecurity from pg_class where oid = 'public.workout_logs'::regclass), 'RLS enabled on workout_logs');
select ok((select relrowsecurity from pg_class where oid = 'public.scheduled_workouts'::regclass), 'RLS enabled on scheduled_workouts');
select ok((select relrowsecurity from pg_class where oid = 'public.favorites'::regclass), 'RLS enabled on favorites');
select ok((select relrowsecurity from pg_class where oid = 'public.saved_meals'::regclass), 'RLS enabled on saved_meals');

-- Exactly the expected policies -----------------------------------------------------------------------------
select policies_are('public', 'profiles',
  array['profiles_select_own', 'profiles_insert_own', 'profiles_update_own', 'profiles_delete_own']);
select policies_are('public', 'food_items',
  array['food_items_select_system', 'food_items_select_visible', 'food_items_insert_own', 'food_items_update_own',
        'food_items_delete_own']);
select policies_are('public', 'meal_logs',
  array['meal_logs_select_own', 'meal_logs_insert_own', 'meal_logs_update_own', 'meal_logs_delete_own']);
select policies_are('public', 'weight_logs',
  array['weight_logs_select_own', 'weight_logs_insert_own', 'weight_logs_update_own', 'weight_logs_delete_own']);
select policies_are('public', 'workout_logs',
  array['workout_logs_select_own', 'workout_logs_insert_own', 'workout_logs_update_own', 'workout_logs_delete_own']);
select policies_are('public', 'scheduled_workouts',
  array['scheduled_workouts_select_own', 'scheduled_workouts_insert_own', 'scheduled_workouts_update_own',
        'scheduled_workouts_delete_own']);
select policies_are('public', 'favorites',
  array['favorites_select_own', 'favorites_insert_own', 'favorites_update_own', 'favorites_delete_own']);
select policies_are('public', 'saved_meals',
  array['saved_meals_select_own', 'saved_meals_insert_own', 'saved_meals_update_own', 'saved_meals_delete_own']);

-- Roles and commands ----------------------------------------------------------------------------------------
select policy_roles_are('public', 'food_items', 'food_items_select_system', array['anon'],
  'signed-out callers may only read the system catalog');
select policy_roles_are('public', 'food_items', 'food_items_select_visible', array['authenticated']);
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and roles <> array['authenticated']::name[] and policyname <> 'food_items_select_system'),
  0::bigint,
  'every other policy applies to the authenticated role only (never PUBLIC)'
);
select results_eq(
  $$ select cmd::text, count(*)::int from pg_policies where schemaname = 'public' group by cmd order by cmd $$,
  $$ values ('DELETE', 8), ('INSERT', 8), ('SELECT', 9), ('UPDATE', 8) $$,
  'one policy per table and command (plus the anon catalog read)'
);

select * from finish();
rollback;
