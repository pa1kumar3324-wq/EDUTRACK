-- ============================================================================
-- 007_volunteers_select_authenticated_only.sql
--
-- CRITICAL FIX: `volunteers_select_all` was defined as
--   using (true)
-- with no `to` clause, which applies to *every* Postgres role — including
-- `anon`. Since the anon key is embedded in every page load, this meant
-- anyone could query name/email/phone/date_of_birth/bio for every volunteer
-- directly against the Supabase REST API with no login at all. This
-- contradicted migration 006's own comment that `date_of_birth` is
-- "only to the volunteer themself or an admin."
--
-- Every sibling policy (students_select_all, assignments_select_all,
-- learning_roadmap_select_all, progress_select_all,
-- student_roadmap_positions_select_all) correctly restricts to
-- `auth.role() = 'authenticated'`. This migration brings volunteers in line.
--
-- Note: this only restores parity with the other tables (any authenticated
-- user can still read full volunteer rows via this policy). H1 addresses
-- the separate problem of full PII reaching non-admin authenticated users
-- at the application layer.
-- ============================================================================

drop policy if exists "volunteers_select_all" on volunteers;

create policy "volunteers_select_all" on volunteers for select
  using (auth.role() = 'authenticated');
