-- ============================================================================
-- Manual verification for
-- supabase/migrations/010_enforce_deactivation_and_purge.sql
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

-- ----------------------------------------------------------------------------
-- SETUP for TEST A/B: a volunteer, an admin, a student, and an assignment
-- linking the volunteer to the student (so progress_insert_own_assignment's
-- is_assigned_to() check has something to succeed against, isolating the
-- is_active checks as the only thing under test).
-- ----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000101', 'test-deactivated-volunteer@example.com'),
  ('00000000-0000-0000-0000-000000000102', 'test-deactivated-admin@example.com')
on conflict (id) do nothing;

insert into volunteers (id, name, email, role, is_active) values
  ('00000000-0000-0000-0000-000000000101', 'Test Deactivated Volunteer', 'test-deactivated-volunteer@example.com', 'volunteer', true),
  ('00000000-0000-0000-0000-000000000102', 'Test Deactivated Admin', 'test-deactivated-admin@example.com', 'admin', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

insert into students (id, name, grade) values
  ('00000000-0000-0000-0000-000000000201', 'Test Student A', 3)
on conflict (id) do nothing;

insert into assignments (student_id, volunteer_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101')
on conflict (student_id, volunteer_id) do nothing;

-- Deactivate both — as service_role, since a volunteer/admin can never flip
-- their own is_active (migration 005's trigger) and we're testing what
-- happens AFTER deactivation, not the deactivation itself (that's already
-- covered by volunteer_privilege_escalation_test.sql TEST 6).
reset role;
set local role service_role;
update volunteers set is_active = false where id in (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102'
);

-- ----------------------------------------------------------------------------
-- TEST A1: a deactivated volunteer CANNOT insert progress, even for a
-- student they're genuinely assigned to.
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000101", "role": "authenticated"}';

do $$
begin
  insert into progress (student_id, volunteer_id, notes)
  values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Should be rejected');
  raise exception 'TEST A1 FAILED: deactivated volunteer was able to insert progress';
exception
  when insufficient_privilege then
    raise notice 'TEST A1 PASSED: progress insert correctly rejected (%)', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- TEST A2: a deactivated volunteer CANNOT update their own volunteers row
-- either — is_active_user() gates volunteers_self_update's USING clause,
-- which is itself a read-check against the volunteers table (RLS's USING
-- clause determines which existing rows are visible for the update in the
-- first place, before WITH CHECK ever runs). Unlike A1, a USING-clause
-- mismatch matches zero rows rather than raising — same as the
-- cross-volunteer case in volunteer_privilege_escalation_test.sql TEST 4 —
-- so we assert the row is unchanged rather than catching an exception.
-- ----------------------------------------------------------------------------
update volunteers set phone = '+1-555-0199' where id = auth.uid();
select 'TEST A2 (deactivated self-update)' as test, phone from volunteers where id = '00000000-0000-0000-0000-000000000101';
-- Expect: phone is still null — the update matched zero rows.

-- ----------------------------------------------------------------------------
-- TEST B: a deactivated admin fails is_admin() — loses admin-level RLS
-- access, not just app-level access.
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000102", "role": "authenticated"}';

select 'TEST B1 (is_admin() for deactivated admin)' as test, is_admin() as result;
-- Expect: result = false.

do $$
begin
  insert into students (name, grade) values ('Should be rejected', 1);
  raise exception 'TEST B2 FAILED: deactivated admin was able to perform an admin-only write';
exception
  when insufficient_privilege then
    raise notice 'TEST B2 PASSED: admin-only write correctly rejected (%)', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- SETUP for TEST C: a volunteer with an authored progress row, and a
-- separate admin who leads an active Learning Circle, to exercise both the
-- success path and the refusal path of purge_volunteer().
-- ----------------------------------------------------------------------------
reset role;
set local role service_role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000103', 'test-purge-volunteer@example.com'),
  ('00000000-0000-0000-0000-000000000104', 'test-circle-lead@example.com')
on conflict (id) do nothing;

insert into volunteers (id, name, email, role, is_active) values
  ('00000000-0000-0000-0000-000000000103', 'Test Purge Volunteer', 'test-purge-volunteer@example.com', 'volunteer', true),
  ('00000000-0000-0000-0000-000000000104', 'Test Circle Lead', 'test-circle-lead@example.com', 'admin', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

insert into students (id, name, grade) values
  ('00000000-0000-0000-0000-000000000202', 'Test Student B', 5)
on conflict (id) do nothing;

insert into progress (id, student_id, volunteer_id, notes) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000103', 'Authored by the volunteer being purged')
on conflict (id) do update set volunteer_id = excluded.volunteer_id;

insert into learning_circles (id, name, lead_admin_id) values
  ('00000000-0000-0000-0000-000000000401', 'Test Purge Refusal Circle', '00000000-0000-0000-0000-000000000104')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- TEST C1: purge_volunteer() REFUSES a volunteer who still leads an active
-- Learning Circle.
-- ----------------------------------------------------------------------------
do $$
begin
  perform purge_volunteer('00000000-0000-0000-0000-000000000104');
  raise exception 'TEST C1 FAILED: purge_volunteer succeeded despite an active Learning Circle lead';
exception
  when sqlstate '23514' then
    raise notice 'TEST C1 PASSED: purge correctly refused (%)', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- TEST C2: purge_volunteer() is NOT callable outside service_role, even by
-- an admin acting as themselves.
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000104", "role": "authenticated"}';

do $$
begin
  perform purge_volunteer('00000000-0000-0000-0000-000000000103');
  raise exception 'TEST C2 FAILED: purge_volunteer was callable by an authenticated admin, not just service_role';
exception
  when insufficient_privilege then
    raise notice 'TEST C2 PASSED: purge correctly refused outside service_role (%)', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- TEST C3: purge_volunteer() SUCCEEDS on a volunteer with existing progress
-- rows, and reassigns those rows to the tombstone rather than deleting them.
-- ----------------------------------------------------------------------------
reset role;
set local role service_role;

select purge_volunteer('00000000-0000-0000-0000-000000000103');

select 'TEST C3a (volunteer row gone)' as test, count(*) as remaining
from volunteers where id = '00000000-0000-0000-0000-000000000103';
-- Expect: remaining = 0.

select 'TEST C3b (auth.users row gone)' as test, count(*) as remaining
from auth.users where id = '00000000-0000-0000-0000-000000000103';
-- Expect: remaining = 0.

select 'TEST C3c (progress row reassigned to tombstone)' as test, volunteer_id
from progress where id = '00000000-0000-0000-0000-000000000301';
-- Expect: volunteer_id = ffffffff-ffff-ffff-ffff-ffffffffffff (the tombstone), not deleted.

rollback; -- discard all test data/changes above
