-- ============================================================================
-- Manual verification for
-- supabase/migrations/011_effort_score.sql
--
-- Covers (feature review, items A-N):
--   A/B  effort_score 1 / 10 accepted
--   C/D  effort_score 0 / 11 rejected
--   E    NULL historical value remains valid
--   F    anon cannot read the effort views
--   G    authenticated user can read the leaderboard
--   H    unverified (pending) scores do not count
--   I    rejected scores do not count
--   J    the "All Students" average aggregates across circles correctly
--   K    a circle leaderboard only aggregates scores from that circle
--   L    the same student can appear in multiple circle leaderboards with
--        different circle-specific averages
--   M    an admin can correct effort_score, and the edit is audit-stamped
--   N    an invalid admin effort_score correction is rejected
--
-- Run this in the Supabase SQL editor (as the `postgres` superuser) against
-- a project with schema.sql + migration 011 applied, to confirm before
-- deploying. Wrap in BEGIN/ROLLBACK so nothing here touches real data.
--
-- IMPORTANT ON TEST F: `set local role anon` alone is NOT a reliable way to
-- prove RLS holds through a view, because a plain view (without
-- security_invoker) is evaluated using the VIEW OWNER's privileges, not the
-- role the session was `set` to — so this exact style of test could read
-- zero rows for reasons that have nothing to do with the view actually
-- being secure (e.g. `postgres` itself lacking a row, or a stale plan). The
-- real proof is structural: this migration confirms `security_invoker` is
-- actually set in the catalog for every effort view, which is the property
-- that makes the `anon` read below meaningful in the first place. If the
-- view definitions are ever changed back to omit `security_invoker`, TEST F
-- STOP would fail immediately, before it even gets to the `anon` query.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- TEST F (STOP CHECK): every effort view actually has security_invoker set.
-- This has to hold BEFORE the anon-role checks below mean anything, so it
-- runs first and aborts the whole script (not just a sub-block) if it ever
-- regresses.
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
  missing text[] := '{}';
begin
  for v in
    select unnest(array[
      'student_effort_summary',
      'student_effort_circle',
      'student_effort_leaderboard',
      'student_effort_leaderboard_by_circle'
    ]) as view_name
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v.view_name
        and c.reloptions is not null
        and 'security_invoker=true' = any(c.reloptions)
    ) then
      missing := missing || v.view_name;
    end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception 'TEST F (STOP) FAILED: security_invoker is NOT set on: %. Every effort view MUST be security_invoker so RLS is enforced as the calling role, not the view owner.', missing;
  else
    raise notice 'TEST F (STOP) PASSED: security_invoker=true confirmed in the catalog for all four effort views';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- FIXTURES
-- ----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'effort-test-volunteer@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'effort-test-admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'effort-test-alpha-lead@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'effort-test-beta-lead@example.com')
on conflict (id) do nothing;

insert into volunteers (id, name, email, role) values
  ('00000000-0000-0000-0000-000000000001', 'Effort Test Volunteer', 'effort-test-volunteer@example.com', 'volunteer'),
  ('00000000-0000-0000-0000-000000000002', 'Effort Test Admin', 'effort-test-admin@example.com', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'Effort Test Alpha Lead', 'effort-test-alpha-lead@example.com', 'admin'),
  ('00000000-0000-0000-0000-0000000000b2', 'Effort Test Beta Lead', 'effort-test-beta-lead@example.com', 'admin')
on conflict (id) do update set role = excluded.role;

insert into students (id, name, grade) values
  ('00000000-0000-0000-0000-0000000000a1', 'Rated Test Student', 3),
  ('00000000-0000-0000-0000-0000000000a2', 'Unrated Test Student', 3),
  ('00000000-0000-0000-0000-0000000000a3', 'Circle Test Student', 3)
on conflict (id) do nothing;

reset role;
set local role service_role;

insert into learning_circles (id, name, lead_admin_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'Effort Test Circle Alpha', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c2', 'Effort Test Circle Beta', '00000000-0000-0000-0000-0000000000b2')
on conflict (id) do update set lead_admin_id = excluded.lead_admin_id;

-- NOTE ON ORDER: volunteer 0001 is deliberately kept OUT of any Learning
-- Circle until after TESTS A-E below. stamp_progress_verification decides
-- pending-vs-verified from the AUTHOR's circle membership AT INSERT TIME —
-- if 0001 were added to Circle Alpha first, the "boundary value" rows
-- TESTS A-E insert for student a1 would land pending instead of verified,
-- and TEST G's average-of-verified-rows assertion further down would fail
-- for a reason that has nothing to do with what TEST G is checking. 0001 is
-- added as a rank-and-file (non-lead) member of Circle Alpha further down,
-- right before it's needed for TEST H.

-- ----------------------------------------------------------------------------
-- TESTS A-E: the 1-10 CHECK constraint on progress.effort_score.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Test topic', 'independent', 0);
    raise exception 'TEST C FAILED: effort_score = 0 was accepted';
  exception
    when check_violation then
      raise notice 'TEST C PASSED: effort_score = 0 rejected by CHECK constraint';
  end;

  begin
    insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Test topic', 'independent', 11);
    raise exception 'TEST D FAILED: effort_score = 11 was accepted';
  exception
    when check_violation then
      raise notice 'TEST D PASSED: effort_score = 11 rejected by CHECK constraint';
  end;
end $$;

-- Boundary values + NULL must all succeed (this is the row the rest of the
-- suite reads, so it's inserted for real, not inside a caught exception).
insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Fractions', 'independent', 1),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Fractions', 'independent', 10),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Fractions', 'independent', null);

do $$
declare
  row_count int;
begin
  select count(*) into row_count
  from progress
  where student_id = '00000000-0000-0000-0000-0000000000a1' and volunteer_id = '00000000-0000-0000-0000-000000000001';
  if row_count < 3 then
    raise exception 'TEST A/B/E FAILED: expected 3 accepted rows (1, 10, null), got %', row_count;
  else
    raise notice 'TEST A PASSED: effort_score = 1 accepted';
    raise notice 'TEST B PASSED: effort_score = 10 accepted';
    raise notice 'TEST E PASSED: effort_score = NULL (historical row) remains valid';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- FIXTURES for TESTS H, I, J, K, L: a student taught through two different
-- Learning Circles, plus a pending and a rejected debrief that must never
-- move any average.
--
-- Both Alpha-lead and Beta-lead file their OWN debriefs, so
-- stamp_progress_verification's "lead verifying their own circle's
-- debrief" branch auto-verifies them immediately (see migration 008) —
-- no separate verification step needed to get real VERIFIED rows here.
-- ----------------------------------------------------------------------------

-- Circle Alpha: two verified sessions, effort 9 and 7 -> average 8.0, count 2.
insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'Fractions', 'independent', 9),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'Fractions', 'independent', 7);

-- Circle Beta: one verified session, effort 10 -> average 10.0, count 1.
insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b2', 'Fractions', 'independent', 10);

do $$
declare
  v_alpha_avg numeric; v_alpha_count int;
  v_beta_avg numeric; v_beta_count int;
begin
  select average_effort_score, effort_score_count into v_alpha_avg, v_alpha_count
  from student_effort_leaderboard_by_circle
  where learning_circle_id = '00000000-0000-0000-0000-0000000000c1'
    and student_id = '00000000-0000-0000-0000-0000000000a3';

  select average_effort_score, effort_score_count into v_beta_avg, v_beta_count
  from student_effort_leaderboard_by_circle
  where learning_circle_id = '00000000-0000-0000-0000-0000000000c2'
    and student_id = '00000000-0000-0000-0000-0000000000a3';

  if v_alpha_avg is distinct from 8.0 or v_alpha_count is distinct from 2 then
    raise exception 'TEST K FAILED: Circle Alpha leaderboard expected average 8.0 / count 2, got average % / count %', v_alpha_avg, v_alpha_count;
  end if;
  if v_beta_avg is distinct from 10.0 or v_beta_count is distinct from 1 then
    raise exception 'TEST K FAILED: Circle Beta leaderboard expected average 10.0 / count 1, got average % / count %', v_beta_avg, v_beta_count;
  end if;
  raise notice 'TEST K PASSED: Circle Alpha (avg 8.0/2) and Circle Beta (avg 10.0/1) each aggregate only their own circle''s sessions';

  if v_alpha_avg = v_beta_avg then
    raise exception 'TEST L FAILED: expected Alpha and Beta averages to differ for the same student';
  else
    raise notice 'TEST L PASSED: student appears on both circle leaderboards with different circle-specific averages (Alpha %, Beta %)', v_alpha_avg, v_beta_avg;
  end if;
end $$;

-- Volunteer 0001 is now added as a rank-and-file member of Circle Alpha
-- (not its lead), so debriefs they file for Circle Alpha students land
-- PENDING, not verified — needed for TEST H below.
insert into learning_circle_members (circle_id, volunteer_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001')
on conflict (volunteer_id) do update set circle_id = excluded.circle_id;

-- Pending debrief filed by a non-lead Alpha member: auto-derived as
-- verification_status = 'pending' by stamp_progress_verification. Deliberately
-- a low effort_score (1) so it would visibly shift Alpha's average (8.0 ->
-- lower) if the view wrongly counted it.
insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'Fractions', 'independent', 1);

do $$
declare
  v_status debrief_verification_status;
  v_alpha_avg numeric; v_alpha_count int;
begin
  select verification_status into v_status
  from progress
  where student_id = '00000000-0000-0000-0000-0000000000a3'
    and volunteer_id = '00000000-0000-0000-0000-000000000001'
    and effort_score = 1;

  if v_status is distinct from 'pending' then
    raise exception 'TEST H SETUP FAILED: expected the fixture debrief to land pending, got %', v_status;
  end if;

  select average_effort_score, effort_score_count into v_alpha_avg, v_alpha_count
  from student_effort_leaderboard_by_circle
  where learning_circle_id = '00000000-0000-0000-0000-0000000000c1'
    and student_id = '00000000-0000-0000-0000-0000000000a3';

  if v_alpha_avg is distinct from 8.0 or v_alpha_count is distinct from 2 then
    raise exception 'TEST H FAILED: an unverified (pending) score moved the Circle Alpha average/count to % / %', v_alpha_avg, v_alpha_count;
  else
    raise notice 'TEST H PASSED: the pending debrief''s effort_score (1) does not count toward Circle Alpha''s average';
  end if;
end $$;

-- A second Alpha debrief, filed the same way, that we then REJECT — must
-- also never count, distinctly from the still-pending one above.
insert into progress (student_id, volunteer_id, math_topic, math_status, effort_score) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'Fractions', 'independent', 2);

update progress set verification_status = 'rejected'
where student_id = '00000000-0000-0000-0000-0000000000a3'
  and volunteer_id = '00000000-0000-0000-0000-000000000001'
  and effort_score = 2;

do $$
declare
  v_alpha_avg numeric; v_alpha_count int;
begin
  select average_effort_score, effort_score_count into v_alpha_avg, v_alpha_count
  from student_effort_leaderboard_by_circle
  where learning_circle_id = '00000000-0000-0000-0000-0000000000c1'
    and student_id = '00000000-0000-0000-0000-0000000000a3';

  if v_alpha_avg is distinct from 8.0 or v_alpha_count is distinct from 2 then
    raise exception 'TEST I FAILED: a rejected score moved the Circle Alpha average/count to % / %', v_alpha_avg, v_alpha_count;
  else
    raise notice 'TEST I PASSED: the rejected debrief''s effort_score (2) does not count toward Circle Alpha''s average';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- TEST J: the "All Students" leaderboard aggregates the student's verified
-- scores across every circle (9, 7, 10 -> average 8.7, count 3), ignoring
-- the pending/rejected rows above exactly like the circle views do.
-- ----------------------------------------------------------------------------
do $$
declare
  v_avg numeric; v_count int;
begin
  select average_effort_score, effort_score_count into v_avg, v_count
  from student_effort_leaderboard
  where student_id = '00000000-0000-0000-0000-0000000000a3';

  if v_avg is distinct from 8.7 or v_count is distinct from 3 then
    raise exception 'TEST J FAILED: expected All Students average 8.7 / count 3, got average % / count %', v_avg, v_count;
  else
    raise notice 'TEST J PASSED: All Students average correctly aggregates 9, 7, 10 across both circles (8.7 / 3)';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- TEST F: anon cannot read any effort view (structural check above already
-- confirmed security_invoker is set; this confirms the resulting behavior).
-- ----------------------------------------------------------------------------
reset role;
set local role anon;

do $$
declare
  row_count int;
begin
  select count(*) into row_count from student_effort_leaderboard;
  if row_count > 0 then
    raise exception 'TEST F FAILED: anon role could read % row(s) from student_effort_leaderboard', row_count;
  end if;

  select count(*) into row_count from student_effort_leaderboard_by_circle;
  if row_count > 0 then
    raise exception 'TEST F FAILED: anon role could read % row(s) from student_effort_leaderboard_by_circle', row_count;
  end if;

  raise notice 'TEST F PASSED: anon role reads zero rows from either leaderboard view';
end $$;

-- ----------------------------------------------------------------------------
-- TEST G: any authenticated user (volunteer, no special role) can read the
-- leaderboard — same access progress_select_all already grants.
-- ----------------------------------------------------------------------------
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

do $$
declare
  the_score numeric;
  the_count int;
begin
  select average_effort_score, effort_score_count into the_score, the_count
  from student_effort_leaderboard
  where student_id = '00000000-0000-0000-0000-0000000000a1';

  if the_score is null then
    raise exception 'TEST G FAILED: authenticated volunteer (non-admin) could not read the leaderboard row';
  elsif the_score <> 5.5 or the_count <> 2 then
    -- Average of the two non-null scores (1, 10) = 5.5; the NULL row must
    -- not count toward effort_score_count.
    raise exception 'TEST G FAILED: expected average 5.5 / count 2, got average % / count %', the_score, the_count;
  else
    raise notice 'TEST G PASSED: authenticated volunteer reads average %.1 / % sessions (NULL correctly excluded)', the_score, the_count;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- A student with zero rated sessions never appears on the leaderboard — no
-- row ever reads as "0/10".
-- ----------------------------------------------------------------------------
do $$
declare
  row_count int;
begin
  select count(*) into row_count
  from student_effort_leaderboard
  where student_id = '00000000-0000-0000-0000-0000000000a2';
  if row_count > 0 then
    raise exception 'TEST FAILED: unrated student appeared in the leaderboard';
  else
    raise notice 'TEST PASSED: unrated student is absent from the leaderboard, not shown as 0/10';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- TESTS M, N: admin correction of effort_score via progress_admin_write,
-- exercised directly at the RLS/trigger layer (the same layer
-- PATCH /api/progress/[id] relies on).
-- ----------------------------------------------------------------------------
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

do $$
declare
  v_target_id uuid;
  v_new_score int;
  v_edited_by uuid;
  v_edited_at timestamptz;
begin
  select id into v_target_id
  from progress
  where student_id = '00000000-0000-0000-0000-0000000000a1'
    and volunteer_id = '00000000-0000-0000-0000-000000000001'
    and effort_score = 1;

  update progress set effort_score = 5 where id = v_target_id;

  select effort_score, edited_by, edited_at into v_new_score, v_edited_by, v_edited_at
  from progress where id = v_target_id;

  if v_new_score is distinct from 5 then
    raise exception 'TEST M FAILED: admin correction of effort_score did not persist (got %)', v_new_score;
  elsif v_edited_by is distinct from '00000000-0000-0000-0000-000000000002'::uuid or v_edited_at is null then
    raise exception 'TEST M FAILED: effort_score changed but edited_by/edited_at were not stamped (edited_by=%, edited_at=%)', v_edited_by, v_edited_at;
  else
    raise notice 'TEST M PASSED: admin corrected effort_score to % and the edit was audit-stamped (edited_by=%, edited_at=%)', v_new_score, v_edited_by, v_edited_at;
  end if;

  begin
    update progress set effort_score = 11 where id = v_target_id;
    raise exception 'TEST N FAILED: an out-of-range admin effort_score correction (11) was accepted';
  exception
    when check_violation then
      raise notice 'TEST N PASSED: an out-of-range admin effort_score correction (11) was rejected by the CHECK constraint';
  end;
end $$;

rollback; -- discard all test data/changes above
