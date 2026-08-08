-- ============================================================================
-- EduTrack — Volunteer Learning Management System
-- Supabase / PostgreSQL schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'volunteer');
create type proficiency_level as enum ('beginner', 'developing', 'proficient', 'advanced');
create type understanding_status as enum ('independent', 'needs_help', 'not_understood');
create type subject as enum ('english', 'math');

-- ----------------------------------------------------------------------------
-- VOLUNTEERS
-- One row per authenticated user (admin or volunteer). id mirrors auth.users.id
-- so RLS can key off auth.uid() directly.
-- ----------------------------------------------------------------------------
create table volunteers (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null unique,
  phone       text,
  role        user_role not null default 'volunteer',
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table volunteers is 'Every user of the system: admins and volunteers alike, distinguished by role.';

-- ----------------------------------------------------------------------------
-- STUDENTS
-- ----------------------------------------------------------------------------
create table students (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  grade          smallint not null check (grade between 1 and 12),
  english_level  proficiency_level not null default 'beginner',
  math_level     proficiency_level not null default 'beginner',
  photo_url      text,
  guardian_name  text,
  guardian_phone text,
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_students_grade on students (grade);
create index idx_students_active on students (is_active) where is_active;

-- ----------------------------------------------------------------------------
-- ASSIGNMENTS  (many-to-many: volunteers <-> students)
-- ----------------------------------------------------------------------------
create table assignments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,
  volunteer_id  uuid not null references volunteers (id) on delete cascade,
  assigned_by   uuid references volunteers (id) on delete set null,
  assigned_at   timestamptz not null default now(),
  unique (student_id, volunteer_id)
);

create index idx_assignments_student on assignments (student_id);
create index idx_assignments_volunteer on assignments (volunteer_id);

-- ----------------------------------------------------------------------------
-- LEARNING ROADMAP
-- Ordered curriculum per grade/subject. "order_index" defines topic sequence;
-- the app recommends the next topic a student hasn't yet reached "proficient" on.
-- ----------------------------------------------------------------------------
create table learning_roadmap (
  id           uuid primary key default gen_random_uuid(),
  grade        smallint not null check (grade between 1 and 12),
  subject      subject not null,
  topic        text not null,
  description  text,
  order_index  integer not null,
  created_at   timestamptz not null default now(),
  unique (grade, subject, order_index)
);

create index idx_roadmap_grade_subject on learning_roadmap (grade, subject, order_index);

-- ----------------------------------------------------------------------------
-- PROGRESS
-- One row per tutoring session update. This is the append-only ledger that
-- powers continuity: every volunteer reads this before teaching, every
-- volunteer writes to it after teaching.
-- ----------------------------------------------------------------------------
create table progress (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references students (id) on delete cascade,
  volunteer_id          uuid not null references volunteers (id) on delete restrict,
  english_topic         text,
  english_status        understanding_status,
  math_topic            text,
  math_status           understanding_status,
  homework              text,
  notes                 text,
  suggested_next_lesson text,
  session_date          date not null default current_date,
  created_at            timestamptz not null default now()
);

create index idx_progress_student on progress (student_id, created_at desc);
create index idx_progress_volunteer on progress (volunteer_id, created_at desc);
create index idx_progress_created on progress (created_at desc);

-- Keep students.updated_at (and levels, indirectly, via the app layer) in sync
-- whenever a new progress entry lands.
create or replace function touch_student_on_progress()
returns trigger
language plpgsql
security definer
as $$
begin
  update students set updated_at = now() where id = new.student_id;
  return new;
end;
$$;

create trigger trg_touch_student_on_progress
after insert on progress
for each row execute function touch_student_on_progress();

-- ----------------------------------------------------------------------------
-- VIEWS — precomputed shapes the UI reads directly, so business logic
-- (continuity, revision flags, staleness) lives in one place.
-- ----------------------------------------------------------------------------

-- Latest progress row per student, with the volunteer's name resolved.
create or replace view latest_progress as
select distinct on (p.student_id)
  p.*,
  v.name as volunteer_name
from progress p
join volunteers v on v.id = p.volunteer_id
order by p.student_id, p.created_at desc;

-- Students flagged "needs revision": two most recent statuses in either
-- subject are 'not_understood', or no update in 14+ days.
create or replace view students_needing_revision as
with ranked as (
  select
    p.*,
    row_number() over (partition by p.student_id order by p.created_at desc) as rn
  from progress p
)
select
  s.id as student_id,
  s.name,
  s.grade,
  coalesce(max(s.updated_at), s.created_at) as last_activity,
  bool_or(
    r1.english_status = 'not_understood' and r2.english_status = 'not_understood'
  ) as english_double_red,
  bool_or(
    r1.math_status = 'not_understood' and r2.math_status = 'not_understood'
  ) as math_double_red,
  (coalesce(max(s.updated_at), s.created_at) < now() - interval '14 days') as stale
from students s
left join ranked r1 on r1.student_id = s.id and r1.rn = 1
left join ranked r2 on r2.student_id = s.id and r2.rn = 2
where s.is_active
group by s.id, s.name, s.grade, s.created_at
having
  bool_or(r1.english_status = 'not_understood' and r2.english_status = 'not_understood')
  or bool_or(r1.math_status = 'not_understood' and r2.math_status = 'not_understood')
  or (coalesce(max(s.updated_at), s.created_at) < now() - interval '14 days');

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Admins: full access. Volunteers: read all students/roadmap (context helps
-- continuity even outside their own assignments), but can only write progress
-- for students assigned to them, and cannot touch assignments or roadmap.
-- ----------------------------------------------------------------------------
alter table volunteers enable row level security;
alter table students enable row level security;
alter table assignments enable row level security;
alter table learning_roadmap enable row level security;
alter table progress enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from volunteers where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_assigned_to(p_student_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from assignments
    where student_id = p_student_id and volunteer_id = auth.uid()
  );
$$;

-- volunteers table
create policy "volunteers_select_all" on volunteers for select using (true);
create policy "volunteers_admin_write" on volunteers for all
  using (is_admin()) with check (is_admin());
create policy "volunteers_self_update" on volunteers for update
  using (id = auth.uid()) with check (id = auth.uid());

-- students table — everyone authenticated can read; only admins write
create policy "students_select_all" on students for select using (auth.role() = 'authenticated');
create policy "students_admin_write" on students for all
  using (is_admin()) with check (is_admin());

-- assignments — everyone can read (so volunteers see who else is on a case);
-- only admins manage
create policy "assignments_select_all" on assignments for select using (auth.role() = 'authenticated');
create policy "assignments_admin_write" on assignments for all
  using (is_admin()) with check (is_admin());

-- roadmap — everyone can read; only admins write
create policy "roadmap_select_all" on learning_roadmap for select using (auth.role() = 'authenticated');
create policy "roadmap_admin_write" on learning_roadmap for all
  using (is_admin()) with check (is_admin());

-- progress — everyone can read (continuity requires full history visibility);
-- volunteers may insert only for students assigned to them; admins bypass
create policy "progress_select_all" on progress for select using (auth.role() = 'authenticated');
create policy "progress_insert_own_assignment" on progress for insert
  with check (is_admin() or (volunteer_id = auth.uid() and is_assigned_to(student_id)));
create policy "progress_admin_write" on progress for update using (is_admin());
create policy "progress_admin_delete" on progress for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- New auth user -> volunteers row (defaults to 'volunteer'; promote via
-- admin panel or directly in the table).
-- ----------------------------------------------------------------------------
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into volunteers (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email, 'volunteer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- ATTENDANCE
-- Leaders (admins) mark volunteer attendance per session date; volunteers
-- can view their own history (used for the pie-chart on their dashboard).
-- ----------------------------------------------------------------------------
create type attendance_status as enum ('present', 'absent', 'late', 'excused');

create table attendance (
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

create index idx_attendance_volunteer on attendance (volunteer_id);
create index idx_attendance_date on attendance (session_date);

create or replace function touch_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_attendance
before update on attendance
for each row execute function touch_attendance_updated_at();

alter table attendance enable row level security;

create policy "attendance_admin_all" on attendance for all
  using (is_admin()) with check (is_admin());

create policy "attendance_self_select" on attendance for select
  using (volunteer_id = auth.uid());
