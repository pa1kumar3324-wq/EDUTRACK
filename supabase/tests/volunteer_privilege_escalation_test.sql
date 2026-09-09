-- ============================================================================
-- Manual verification for
-- supabase/migrations/005_volunteer_privilege_escalation_guard.sql
--
-- This sandbox has no network access to a live Supabase project, so this
-- fix could not be executed against real Postgres/PostgREST as part of this
-- change — see the final report. Run this in the Supabase SQL editor (as
-- the `postgres` superuser, which can freely impersonate other roles via
-- `set local role`/`set local "request.jwt.claims"`) against a project
-- with schema.sql + this migration applied, to confirm the fix before
-- deploying.
--
-- Each block is independent; run them in order in a single transaction
-- (or wrap each in BEGIN/ROLLBACK) so nothing here touches real data.
-- ============================================================================

begin;

-- Set up two volunteers to test with.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'test-volunteer@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'test-admin@example.com')
on conflict (id) do nothing;

insert into volunteers (id, name, email, role) values
  ('00000000-0000-0000-0000-000000000001', 'Test Volunteer', 'test-volunteer@example.com', 'volunteer'),
  ('00000000-0000-0000-0000-000000000002', 'Test Admin', 'test-admin@example.com', 'admin')
on conflict (id) do update set role = excluded.role;

-- ----------------------------------------------------------------------------
-- TEST 1: volunteer CAN perform a legitimate self-update (e.g. phone).
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

update volunteers set phone = '+1-555-0100' where id = auth.uid();
-- Expect: succeeds, 1 row updated.
select 'TEST 1 (self phone update)' as test, phone from volunteers where id = '00000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------
-- TEST 2: volunteer CANNOT change their own role.
-- ----------------------------------------------------------------------------
do $$
begin
  update volunteers set role = 'admin' where id = auth.uid();
  raise exception 'TEST 2 FAILED: volunteer was able to self-promote to admin';
exception
  when insufficient_privilege then
    raise notice 'TEST 2 PASSED: role change correctly rejected (%)', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- TEST 3: volunteer CANNOT reactivate/deactivate themselves.
-- ----------------------------------------------------------------------------
do $$
begin
  update volunteers set is_active = false where id = auth.uid();
  raise exception 'TEST 3 FAILED: volunteer was able to change is_active';
exception
  when insufficient_privilege then
    raise notice 'TEST 3 PASSED: is_active change correctly rejected (%)', sqlerrm;
end $$;

-- Confirm the volunteer's row is genuinely untouched by the rejected attempts.
select 'TEST 2+3 (row unchanged)' as test, role, is_active from volunteers where id = '00000000-0000-0000-0000-000000000001';
-- Expect: role = 'volunteer', is_active = true (the rejected updates left no partial effect).

-- ----------------------------------------------------------------------------
-- TEST 4: volunteer CANNOT update another volunteer's row at all (unchanged
-- pre-existing RLS behavior — sanity check that this fix didn't touch it).
-- ----------------------------------------------------------------------------
update volunteers set name = 'Hijacked' where id = '00000000-0000-0000-0000-000000000002';
select 'TEST 4 (cross-volunteer update)' as test, name from volunteers where id = '00000000-0000-0000-0000-000000000002';
-- Expect: name is still 'Test Admin' — RLS's `id = auth.uid()` check silently
-- matched zero rows, so nothing changed (Postgres RLS filters rows rather
-- than raising for an update that matches none).

-- ----------------------------------------------------------------------------
-- TEST 5: admin CAN change a volunteer's role (legitimate promotion/demotion).
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

update volunteers set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
select 'TEST 5 (admin promotes volunteer)' as test, role from volunteers where id = '00000000-0000-0000-0000-000000000001';
-- Expect: role = 'admin' — admins retain full write access via
-- "volunteers_admin_write" + the trigger's is_admin() bypass.

-- ----------------------------------------------------------------------------
-- TEST 6: admin CAN deactivate a volunteer.
-- ----------------------------------------------------------------------------
update volunteers set is_active = false where id = '00000000-0000-0000-0000-000000000001';
select 'TEST 6 (admin deactivates volunteer)' as test, is_active from volunteers where id = '00000000-0000-0000-0000-000000000001';
-- Expect: is_active = false.

-- ----------------------------------------------------------------------------
-- TEST 7: service_role (the invite flow / seed script's connection) can
-- still set role/is_active directly, same as before this migration.
-- ----------------------------------------------------------------------------
reset role;
set local role service_role;

update volunteers set role = 'volunteer', is_active = true where id = '00000000-0000-0000-0000-000000000001';
select 'TEST 7 (service_role write)' as test, role, is_active from volunteers where id = '00000000-0000-0000-0000-000000000001';
-- Expect: succeeds — role = 'volunteer', is_active = true.

rollback; -- discard all test data/changes above
