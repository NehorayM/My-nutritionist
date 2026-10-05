-- pgTAP: RLS behaviour for the API roles, simulated in SQL (`set local role` + JWT claims), rolled back at the end.
-- The end-to-end variant through PostgREST lives in tests/db/*.test.ts (`npm run test:db`).
begin;
select plan(14);

-- Arrange (as postgres): users A and B, one private food and one weigh-in of B -----------------------------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'pgtap-a@my-nutritionist.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'pgtap-b@my-nutritionist.test', 'authenticated', 'authenticated');
insert into public.food_items (id, source, name, nutrients_per_100g, created_by) values
  ('bbbbbbbb-f00d-4000-8000-00000000000b', 'custom', 'Private food of B', '{"calories": 100}',
   'bbbbbbbb-0000-4000-8000-00000000000b');
insert into public.weight_logs (id, user_id, measured_on, measured_at, weight_kg) values
  ('bbbbbbbb-3e16-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-00000000000b', '2026-10-04',
   '2026-10-04T07:00:00Z', 70);

-- Signed out (anon) ----------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select ok((select count(*) from public.food_items) >= 60, 'anon reads the system catalog');
select is((select count(*) from public.food_items where created_by is not null), 0::bigint,
  'anon never sees custom foods');
select throws_ok($$ select count(*) from public.weight_logs $$, '42501', null, 'anon cannot read weight_logs');
select throws_ok($$ insert into public.food_items (source, name, nutrients_per_100g) values ('system', 'x', '{}') $$,
  '42501', null, 'anon cannot add system foods');

-- Signed in as A -------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-00000000000a", "role": "authenticated"}';
select is_empty($$ select id from public.weight_logs $$, 'A sees none of B''s weigh-ins');
select is_empty($$ select id from public.food_items where created_by is not null $$, 'A does not see B''s food');
select throws_ok(
  $$ insert into public.weight_logs (user_id, measured_on, measured_at, weight_kg)
     values ('bbbbbbbb-0000-4000-8000-00000000000b', '2026-10-04', '2026-10-04T08:00:00Z', 60) $$,
  '42501', null, 'A cannot write a weigh-in for B');
select lives_ok(
  $$ insert into public.weight_logs (user_id, measured_on, measured_at, weight_kg)
     values ('aaaaaaaa-0000-4000-8000-00000000000a', '2026-10-04', '2026-10-04T08:00:00Z', 81.5) $$,
  'A can write an own weigh-in');
select throws_ok(
  $$ insert into public.favorites (user_id, food_id)
     values ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-f00d-4000-8000-00000000000b') $$,
  '42501', null, 'A cannot favorite B''s private food');
select throws_ok(
  $$ insert into public.food_items (source, name, nutrients_per_100g, created_by)
     values ('system', 'Fake system food', '{}', null) $$,
  '42501', null, 'A cannot create a system food');
update public.weight_logs set weight_kg = 50 where id = 'bbbbbbbb-3e16-4000-8000-00000000000b';
delete from public.food_items where id = 'bbbbbbbb-f00d-4000-8000-00000000000b';
update public.food_items set name = 'Renamed' where created_by is null;

-- Assert (as postgres): nothing of B or of the catalog changed ------------------------------------------------
reset role;
select is((select weight_kg from public.weight_logs where id = 'bbbbbbbb-3e16-4000-8000-00000000000b'), 70.00,
  'A''s update of B''s weigh-in changed nothing');
select is((select count(*) from public.food_items where id = 'bbbbbbbb-f00d-4000-8000-00000000000b'), 1::bigint,
  'A''s delete of B''s food removed nothing');
select is((select count(*) from public.food_items where created_by is null and name = 'Renamed'), 0::bigint,
  'A''s update of system foods changed nothing');
select is(
  (select count(*) from public.weight_logs where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 1::bigint,
  'A''s own weigh-in was stored');

select * from finish();
rollback;
