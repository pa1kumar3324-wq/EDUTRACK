-- ============================================================================
-- EduTrack — Migration: Weekly Effort Score + Leaderboard
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and migrations 001-010) applied.
--
-- WHAT THIS ADDS
-- ---------------------------------------------------------------------------
-- `progress.effort_score` — an integer 1-10 a volunteer gives a student for
-- EFFORT (participation, persistence, willingness to try) when they submit a
-- session debrief. It is deliberately NOT a measure of English/Math
-- correctness or academic ability — see the helper text in
-- components/progress/EffortScorePicker.tsx and
-- lib/validations/progress.ts for the exact wording shown to volunteers.
--
-- This is purely additive: ONE nullable integer column on the existing
-- `progress` row (one row per session already), exactly like
-- `session_observations` (migration 004) — no new table, since a session
-- already has one row per student/session and effort is a property of that
-- session. Every existing `progress` row gets effort_score = NULL, which
-- reads everywhere as "not rated", never as a score of zero.
--
-- Three read-only views compute the leaderboard server-side (AVG/COUNT
-- grouped by student), so the app never has to fetch every student's
-- progress history individually and reduce it in JS — same reasoning as
-- the existing `latest_progress` / `students_needing_revision` views:
--
--   * student_effort_summary   — one row per student with at least one
--     rated, VERIFIED session: average_effort_score, effort_score_count.
--     Unverified (pending/rejected) debriefs never count, for the same
--     reason weakTopics()/latest_progress don't count them (see
--     lib/repositories/analyticsRepository.ts's closing note): an
--     unverified claim about a session shouldn't move a student's
--     standing on a leaderboard their peers can see.
--
--   * student_effort_circle    — the Learning Circle credited with each
--     rated student's MOST RECENT rated, verified session (or null for a
--     student whose rater(s) belong to no circle). Students don't belong
--     to a Learning Circle directly in this schema — only volunteers do,
--     via learning_circle_members — so "which circle is this student in,
--     for leaderboard purposes" is derived from progress.learning_circle_id
--     (snapshotted on each debrief at insert time; see migration 008),
--     taking the newest rated session as the student's "current" circle.
--     This is a deliberate, documented judgment call, not a designed
--     student<->circle relationship: it reuses the existing relationship
--     rather than inventing a new one (per the feature spec).
--
--   * student_effort_leaderboard — students joined to both of the above,
--     ready to page straight into a UI table or an export: student_id,
--     student_name, average_effort_score, effort_score_count,
--     learning_circle_id, learning_circle_name. A student with zero rated
--     sessions never appears here (inner join to student_effort_summary) —
--     exactly the "don't show 0/10" rule the feature spec calls for.
--
-- RLS: views select only from `progress`, `students`, and `learning_circles`
-- — all three already have a `select using (auth.role() = 'authenticated')`
-- policy (see supabase/schema.sql). A plain Postgres view runs with the
-- privileges of its OWNER when checking row security on the tables it
-- reads, not the privileges of whoever is querying the view — so without
-- `security_invoker`, these views would be evaluated as their owning role
-- (created via the migration runner, which is not subject to `progress`'s
-- RLS) and every one of the `authenticated`-only policies below would be
-- silently bypassed, letting `anon` read the full leaderboard through the
-- view even though it can't read `progress` directly. Every view below is
-- therefore created `WITH (security_invoker = true)` (Postgres 15+/Supabase
-- default), which makes Postgres re-check RLS as the CALLING role instead —
-- the same behavior `latest_progress`/`students_needing_revision` should
-- also have, but those predate this requirement and are out of scope here.
-- This is a DB-level guarantee: the application's requireUserApi() check in
-- app/api/effort-leaderboard/route.ts is a UX/routing concern, not a
-- substitute for it, and must not be relied on as the sole access control.
-- ============================================================================

alter table progress
  add column if not exists effort_score integer;

alter table progress
  add constraint progress_effort_score_range
  check (effort_score is null or effort_score between 1 and 10);

comment on column progress.effort_score is
  'Volunteer-given rating (1-10) of the STUDENT''S EFFORT this session — participation, persistence, willingness to try. Explicitly NOT a measure of English/Math correctness or academic ability. Null for historical rows predating this column and for any row where the volunteer skipped it. See lib/validations/progress.ts and components/progress/EffortScorePicker.tsx.';

-- ----------------------------------------------------------------------------
-- VIEWS
-- ----------------------------------------------------------------------------

create or replace view student_effort_summary
  with (security_invoker = true) as
select
  p.student_id,
  round(avg(p.effort_score)::numeric, 1) as average_effort_score,
  count(p.effort_score) as effort_score_count
from progress p
where p.verification_status = 'verified'
  and p.effort_score is not null
group by p.student_id;

alter view student_effort_summary set (security_invoker = true);

comment on view student_effort_summary is
  'Per-student effort average + rating count, from verified sessions with a non-null effort_score only. A student with no rated sessions has no row here — never a row reading 0/10. security_invoker = true: RLS on `progress` is enforced as the CALLING role, not the view owner — see this migration''s header comment.';

create or replace view student_effort_circle
  with (security_invoker = true) as
select distinct on (p.student_id)
  p.student_id,
  p.learning_circle_id,
  lc.name as learning_circle_name
from progress p
left join learning_circles lc on lc.id = p.learning_circle_id
where p.verification_status = 'verified'
  and p.effort_score is not null
order by p.student_id, p.created_at desc;

alter view student_effort_circle set (security_invoker = true);

comment on view student_effort_circle is
  'The Learning Circle credited with each rated student''s most recent rated, verified session (null if that session''s author belonged to no circle). Purely a DISPLAY label on the "All Students" leaderboard scope — see student_effort_leaderboard_by_circle below for the view that actually drives a single Learning Circle''s leaderboard numbers. security_invoker = true: RLS enforced as the calling role.';

create or replace view student_effort_leaderboard
  with (security_invoker = true) as
select
  s.id as student_id,
  s.name as student_name,
  es.average_effort_score,
  es.effort_score_count,
  ec.learning_circle_id,
  ec.learning_circle_name
from students s
join student_effort_summary es on es.student_id = s.id
left join student_effort_circle ec on ec.student_id = s.id
where s.is_active;

alter view student_effort_leaderboard set (security_invoker = true);

comment on view student_effort_leaderboard is
  'Ready-to-render "All Students" Effort Leaderboard rows: active students with at least one rated, verified session anywhere in the org, joined ONLY for display to the Learning Circle that logged their most recent rated session. Order by average_effort_score DESC, effort_score_count DESC per the feature spec. security_invoker = true: RLS enforced as the calling role, not this view''s owner.';

-- ----------------------------------------------------------------------------
-- A single Learning Circle's leaderboard is a DIFFERENT aggregation from the
-- "All Students" one above, not a filter over it. Students don't belong to a
-- Learning Circle directly — only volunteers do, via learning_circle_members
-- — so `student_effort_circle` above picks one "credited" circle per student
-- (their most recently rated session) purely so the "All Students" table has
-- something to show in its Learning Circle column. Using that same derived,
-- single credited circle to decide who counts (and with what average) on a
-- SPECIFIC circle's own leaderboard would be misleading: a student taught
-- mostly through Circle Alpha who happens to have one recent Circle Beta
-- session would have their entire Alpha history vanish from Alpha's board
-- and their Alpha-heavy average get attributed to Beta instead.
--
-- Instead, a circle's leaderboard aggregates directly from the sessions
-- that actually belong to it: every verified, rated `progress` row whose
-- `learning_circle_id` is that circle (per migration 008 — the circle
-- snapshotted onto the debrief at insert time), grouped by student. This
-- view computes that for every (circle, student) pair at once; the caller
-- filters to one `learning_circle_id`. A student who has been taught
-- through more than one circle legitimately gets a separate row — and a
-- separate average — per circle, and can appear on more than one circle's
-- leaderboard at once. That is intentional: it is preferable to collapsing
-- their whole history onto whichever circle happened to submit last.
-- ----------------------------------------------------------------------------

create or replace view student_effort_leaderboard_by_circle
  with (security_invoker = true) as
select
  p.learning_circle_id,
  lc.name as learning_circle_name,
  s.id as student_id,
  s.name as student_name,
  round(avg(p.effort_score)::numeric, 1) as average_effort_score,
  count(p.effort_score) as effort_score_count
from progress p
join students s on s.id = p.student_id
join learning_circles lc on lc.id = p.learning_circle_id
where p.verification_status = 'verified'
  and p.effort_score is not null
  and s.is_active
group by p.learning_circle_id, lc.name, s.id, s.name;

alter view student_effort_leaderboard_by_circle set (security_invoker = true);

comment on view student_effort_leaderboard_by_circle is
  'Per-(Learning Circle, student) effort average + rating count, from that circle''s own verified, rated progress rows only (progress.learning_circle_id — see migration 008), not a student''s org-wide average. A caller filters `where learning_circle_id = :circle` to render one circle''s leaderboard; a student taught through multiple circles legitimately has one row per circle here, each with its own average/count. security_invoker = true: RLS on `progress`/`students`/`learning_circles` is enforced as the calling role.';

-- ----------------------------------------------------------------------------
-- ADMIN EFFORT-SCORE CORRECTION
-- The admin progress-edit route (PATCH /api/progress/[id]) can now correct
-- effort_score the same way it already corrects topic/status/homework/notes
-- — an ordinary debrief content fix, not a verification-state change
-- (guard_debrief_verification, migration 008, only watches
-- learning_circle_id/verification_status and is untouched by this). The one
-- thing that was missing: stamp_progress_edit() (migration 009) didn't list
-- effort_score among the columns that stamp edited_by/edited_at, so an
-- admin's correction to it would have gone unaudited. This re-defines that
-- function, additively, to also watch effort_score — everything else about
-- it (service_role bypass, which columns it does NOT touch) is unchanged.
-- ----------------------------------------------------------------------------

create or replace function stamp_progress_edit()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.english_topic         is distinct from old.english_topic
  or new.english_status        is distinct from old.english_status
  or new.english_roadmap_id    is distinct from old.english_roadmap_id
  or new.math_topic            is distinct from old.math_topic
  or new.math_status            is distinct from old.math_status
  or new.math_roadmap_id       is distinct from old.math_roadmap_id
  or new.homework               is distinct from old.homework
  or new.notes                  is distinct from old.notes
  or new.session_observations   is distinct from old.session_observations
  or new.effort_score            is distinct from old.effort_score
  then
    new.edited_by := auth.uid();
    new.edited_at := now();
  end if;

  return new;
end;
$$;
