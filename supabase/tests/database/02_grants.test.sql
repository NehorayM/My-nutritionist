-- pgTAP: Data API grants are explicit and minimal (supabase/migrations/002_rls_policies.sql §1).
begin;
select plan(31);

-- anon: read the system catalog only ----------------------------------------------------------------------
select table_privs_are('public', 'food_items', 'anon', array['SELECT']);
select table_privs_are('public', 'profiles', 'anon', array[]::text[]);
select table_privs_are('public', 'meal_logs', 'anon', array[]::text[]);
select table_privs_are('public', 'weight_logs', 'anon', array[]::text[]);
select table_privs_are('public', 'workout_logs', 'anon', array[]::text[]);
select table_privs_are('public', 'scheduled_workouts', 'anon', array[]::text[]);
select table_privs_are('public', 'favorites', 'anon', array[]::text[]);
select table_privs_are('public', 'saved_meals', 'anon', array[]::text[]);

-- authenticated: CRUD (RLS limits rows), never TRUNCATE / REFERENCES / TRIGGER -----------------------------
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'food_items', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'meal_logs', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'weight_logs', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'workout_logs', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'scheduled_workouts', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'favorites', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'saved_meals', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);

-- service_role (secret key, server-side only) -----------------------------------------------------------
select table_privs_are('public', 'profiles', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'food_items', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'meal_logs', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'weight_logs', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'workout_logs', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'scheduled_workouts', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'favorites', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'saved_meals', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);

-- Functions: the CHECK-constraint validator stays executable for writers; the trigger function for nobody --
select function_privs_are('public', 'is_valid_nutrient_map', array['jsonb'], 'anon', array[]::text[]);
select function_privs_are('public', 'is_valid_nutrient_map', array['jsonb'], 'authenticated', array['EXECUTE']);
select function_privs_are('public', 'is_valid_nutrient_map', array['jsonb'], 'service_role', array['EXECUTE']);
select function_privs_are('public', 'guard_stale_write', array[]::text[], 'anon', array[]::text[]);
select function_privs_are('public', 'guard_stale_write', array[]::text[], 'authenticated', array[]::text[]);
select function_privs_are('public', 'guard_stale_write', array[]::text[], 'service_role', array[]::text[]);

-- Future objects created by migrations get no automatic Data API access --------------------------------
select is(
  (select count(*) from pg_default_acl d, aclexplode(d.defaclacl) acl
   where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace
     and acl.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)),
  0::bigint,
  'no default privileges for API roles on new objects in public'
);

select * from finish();
rollback;
