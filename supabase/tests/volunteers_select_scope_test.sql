-- ============================================================================
-- Manual verification for
-- supabase/migrations/007_volunteers_select_authenticated_only.sql
--
-- Covers SELECT-scope access to `volunteers`, which was never exercised by
-- `volunteer_privilege_escalation_test.sql` (that suite only covers
-- UPDATE-based privilege escalation on role/is_active). This is a separate,
-- independent guard: an anonymous request should never be able to read the
-- volunteers table at all, regardless of what it tries to write.
--
-- Run this in the Supabase SQL editor (as the `postgres` superuser)
-- against a project with schema.sql + migration 007 applied, to confirm
-- before deploying.
--
-- Wrap in BEGIN/ROLLBACK so nothing here touches real data.
-- ============================================================================

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'test-volunteer@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'test-admin@example.com')
on conflict (id) do nothing;

insert into volunteers (id, name, email, role, phone, date_of_birth) values
  ('00000000-0000-0000-0000-000000000001', 'Test Volunteer', 'test-volunteer@example.com', 'volunteer', '+1-555-0100', '1990-01-01'),
  ('00000000-0000-0000-0000-000000000002', 'Test Admin', 'test-admin@example.com', 'admin', '+1-555-0200', '1985-06-15')
on conflict (id) do update set role = excluded.role;

-- ----------------------------------------------------------------------------
-- TEST 1: the anonymous (unauthenticated) role CANNOT select from
-- volunteers at all. This is the exact hole C1 fixes — before this
-- migration, `using (true)` with no `to` clause meant `anon` could read
-- every volunteer's full row, including phone/date_of_birth.
-- ----------------------------------------------------------------------------
reset role;
set local role anon;

do $$
declare
  row_count int;
begin
  select count(*) into row_count from volunteers;
  if row_count > 0 then
    raise exception 'TEST 1 FAILED: anon role could read % volunteer row(s)', row_count;
  else
    raise notice 'TEST 1 PASSED: anon role sees zero volunteer rows';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- TEST 2: an authenticated non-admin volunteer CAN select from volunteers
-- (this policy only restricts anon; every authenticated user retaining
-- SELECT access is expected here — see lib/types/database.ts's
-- PublicVolunteer for the separate PII-projection
-- fix that narrows *which fields* non-admins should see).
-- ----------------------------------------------------------------------------
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

do $$
declare
  row_count int;
begin
  select count(*) into row_count from volunteers;
  if row_count < 2 then
    raise exception 'TEST 2 FAILED: authenticated non-admin could not read expected volunteer rows (got %)', row_count;
  else
    raise notice 'TEST 2 PASSED: authenticated non-admin can read volunteer rows (%)', row_count;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- TEST 3: service_role (server-side/admin API usage) retains full SELECT
-- access, same as before this migration.
-- ----------------------------------------------------------------------------
reset role;
set local role service_role;

do $$
declare
  row_count int;
begin
  select count(*) into row_count from volunteers;
  if row_count < 2 then
    raise exception 'TEST 3 FAILED: service_role could not read expected volunteer rows (got %)', row_count;
  else
    raise notice 'TEST 3 PASSED: service_role can read volunteer rows (%)', row_count;
  end if;
end $$;

rollback; -- discard all test data/changes above
