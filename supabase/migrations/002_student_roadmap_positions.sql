-- ============================================================================
-- EduTrack — Migration: Student Roadmap Starting-Baseline Positions
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and 001_attendance.sql) applied.
--
-- This is purely additive: it does not touch `progress`, `students`,
-- `learning_roadmap`, or `attendance`. No existing data is modified.
--
-- Lets a leader (admin) set a student's roadmap STARTING BASELINE per
-- subject — "start this student's roadmap here" — not a permanent pin.
-- Automatic recommendation still advances the student forward from this
-- baseline once progress is recorded (resolved app-side in
-- resolveRoadmapPosition), without altering the append-only `progress`
-- history in any way. At most one row per (student_id, subject) — setting a
-- new baseline replaces the old one for that subject; clearing it deletes
-- the row and restores fully automatic recommendation behavior.
-- ============================================================================

create table if not exists student_roadmap_positions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,
  subject       subject not null,
  roadmap_id    uuid not null references learning_roadmap (id) on delete cascade,
  set_by        uuid references volunteers (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, subject)
);

create index if not exists idx_student_roadmap_positions_student on student_roadmap_positions (student_id);
create index if not exists idx_student_roadmap_positions_roadmap on student_roadmap_positions (roadmap_id);

create or replace function touch_student_roadmap_position_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_student_roadmap_position on student_roadmap_positions;
create trigger trg_touch_student_roadmap_position
before update on student_roadmap_positions
for each row execute function touch_student_roadmap_position_updated_at();

alter table student_roadmap_positions enable row level security;

-- Everyone authenticated can read (volunteers need to see the leader-assigned
-- position on the student profile, same read pattern as learning_roadmap).
create policy "student_roadmap_positions_select_all" on student_roadmap_positions for select
  using (auth.role() = 'authenticated');

-- Only admins (leaders) can create/update/delete starting-baseline positions — matches
-- the is_admin() pattern used by students/roadmap/attendance policies.
create policy "student_roadmap_positions_admin_write" on student_roadmap_positions for all
  using (is_admin()) with check (is_admin());
