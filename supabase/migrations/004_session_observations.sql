-- ============================================================================
-- EduTrack — Migration: Structured Session Observations
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and 001_attendance.sql,
-- 002_student_roadmap_positions.sql, 003_progress_roadmap_ids.sql) applied.
--
-- Purely additive: adds ONE nullable jsonb column to `progress` to hold the
-- richer, structured per-session observations captured by the revised
-- ProgressForm (mood, energy, attention, participation, confidence,
-- per-subject learning/teaching/outcome observations, session quality —
-- see lib/types/sessionObservations.ts for the exact shape and
-- lib/validations/sessionObservations.ts for the zod schema that validates
-- it before every write).
--
-- A single jsonb column was chosen over one column per new field: this data
-- model is expected to keep growing (new observation types added over time),
-- and a wide, ever-growing set of nullable text/enum columns would mean a
-- new migration for every addition. Postgres does not enforce the internal
-- shape of jsonb — that's enforced at the application boundary instead (see
-- the zod schema above), which is an accepted, explicit trade-off here.
--
-- No existing `progress` rows are modified; the column defaults to null for
-- all of them, and every reader (ProgressTimeline, Tsareena's context
-- builder, etc.) treats a null session_observations exactly like "no
-- structured data was recorded for this session" — never an error.
--
-- RLS: `progress` already has row-level security policies covering select/
-- insert/update/delete (see supabase/schema.sql). Those policies are
-- table-level, not column-level, so this new column automatically inherits
-- the exact same access rules as every other column on `progress`. No new
-- policy is needed or should be added here.
-- ============================================================================

alter table progress
  add column if not exists session_observations jsonb;

comment on column progress.session_observations is
  'Structured per-session observations (mood, participation, lesson execution, teaching approach, outcome, session quality). See lib/types/sessionObservations.ts. Nullable; absent for historical rows and for sessions logged without the structured section filled in.';
