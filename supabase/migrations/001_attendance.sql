-- ============================================================================
-- EduTrack — Migration: Volunteer Attendance
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql applied. (Fresh installs get this automatically —
-- it's also appended to the bottom of schema.sql.)
-- ============================================================================

create type attendance_status as enum ('present', 'absent', 'late', 'excused');

-- One row per volunteer per session date. Leaders (admins) mark these;
-- volunteers can only read their own.
create table if not exists attendance (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references volunteers (id) on delete cascade,
  session_date  date not null,
  status        attendance_status not null default 'present',
  notes         text,
  marked_by     uuid references volunteers (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (volunteer_id, session_date)
);

create index if not exists idx_attendance_volunteer on attendance (volunteer_id);
create index if not exists idx_attendance_date on attendance (session_date);

create or replace function touch_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_attendance on attendance;
create trigger trg_touch_attendance
before update on attendance
for each row execute function touch_attendance_updated_at();

alter table attendance enable row level security;

-- Admins (leaders) can read/write every attendance row.
create policy "attendance_admin_all" on attendance for all
  using (is_admin()) with check (is_admin());

-- Volunteers can read only their own attendance history.
create policy "attendance_self_select" on attendance for select
  using (volunteer_id = auth.uid());
