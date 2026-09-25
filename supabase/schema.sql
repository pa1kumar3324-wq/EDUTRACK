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
  id                  uuid primary key references auth.users (id) on delete cascade,
  name                text not null,
  email               text not null unique,
  phone               text,
  role                user_role not null default 'volunteer',
  avatar_url          text,
  is_active           boolean not null default true,
  -- Profile fields (see supabase/migrations/006_volunteer_profile_fields.sql
  -- for the full rationale). `preferred_name` is the everyday display
  -- identity (falls back to `name` — see displayName() in lib/utils.ts);
  -- `name` stays the official/legal identity used for formal records.
  preferred_name      text check (char_length(preferred_name) <= 100),
  date_of_birth       date,
  bio                 text check (char_length(bio) <= 1000),
  teaching_interests  text check (char_length(teaching_interests) <= 500),
  fun_fact            text check (char_length(fun_fact) <= 280),
  created_at          timestamptz not null default now()
);

comment on table volunteers is 'Every user of the system: admins and volunteers alike, distinguished by role. The row with id ffffffff-ffff-ffff-ffff-ffffffffffff is a reserved tombstone (see purge_volunteer() near the end of this file) — never a real volunteer, never surfaced to invite/assignment flows because is_active = false excludes it from list()/listPublic() like any other deactivated row.';

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
  english_roadmap_id    uuid references learning_roadmap (id) on delete set null,
  math_topic            text,
  math_status           understanding_status,
  math_roadmap_id       uuid references learning_roadmap (id) on delete set null,
  homework              text,
  notes                 text,
  suggested_next_lesson text,
  -- Structured per-session observations (mood, participation, lesson
  -- execution, teaching approach, outcome, session quality). See
  -- lib/types/sessionObservations.ts and
  -- supabase/migrations/004_session_observations.sql.
  session_observations  jsonb,
  -- Volunteer-given rating (1-10) of the STUDENT'S EFFORT this session —
  -- participation, persistence, willingness to try. Explicitly NOT a
  -- measure of English/Math correctness or academic ability. Null means
  -- "not rated", never zero. See supabase/migrations/011_effort_score.sql
  -- and lib/validations/progress.ts.
  effort_score          integer check (effort_score is null or effort_score between 1 and 10),
  session_date          date not null default current_date,
  created_at            timestamptz not null default now()
);

create index idx_progress_student on progress (student_id, created_at desc);
create index idx_progress_volunteer on progress (volunteer_id, created_at desc);
create index idx_progress_created on progress (created_at desc);
create index idx_progress_english_roadmap on progress (english_roadmap_id);
create index idx_progress_math_roadmap on progress (math_roadmap_id);

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

-- Latest progress row per student, with the volunteer's display name
-- resolved (preferred_name when set, else the official name).
create or replace view latest_progress as
select distinct on (p.student_id)
  p.*,
  coalesce(v.preferred_name, v.name) as volunteer_name
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
    select 1 from volunteers where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function is_assigned_to(p_student_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from assignments a
    join volunteers v on v.id = a.volunteer_id
    where a.student_id = p_student_id and a.volunteer_id = auth.uid() and v.is_active
  );
$$;

-- Write-policy equivalent of is_admin()'s is_active check, for policies
-- that gate on "is this the volunteer's own row/data" rather than "is this
-- an admin" — required by progress_insert_own_assignment and
-- volunteers_self_update below. See
-- supabase/migrations/010_enforce_deactivation_and_purge.sql for the full
-- rationale (a deactivated volunteer must lose write access at the RLS
-- layer, not just in the app).
create or replace function is_active_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from volunteers where id = auth.uid() and is_active
  );
$$;

-- volunteers table
create policy "volunteers_select_all" on volunteers for select
  using (auth.role() = 'authenticated');
create policy "volunteers_admin_write" on volunteers for all
  using (is_admin()) with check (is_admin());
create policy "volunteers_self_update" on volunteers for update
  using (id = auth.uid() and is_active_user()) with check (id = auth.uid() and is_active_user());

-- RLS is row-level, not column-level: "volunteers_self_update" above lets a
-- volunteer update their own row, but has no way to say "except role/
-- is_active". Those two columns participate directly in authorization
-- (is_admin() and every policy built on it key off `role`), so a BEFORE
-- UPDATE trigger enforces the column boundary that RLS alone cannot. See
-- supabase/migrations/005_volunteer_privilege_escalation_guard.sql for the
-- full rationale.
create or replace function prevent_volunteer_privilege_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  -- service_role (invite flow, seed script) bypasses RLS by design and has
  -- no auth.uid() to check against — exempt it the same way RLS already
  -- does, rather than letting is_admin() read as false for it below.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'You do not have permission to change your role.' using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'You do not have permission to change your active status.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_prevent_volunteer_privilege_escalation
before update on volunteers
for each row execute function prevent_volunteer_privilege_escalation();

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
  with check (is_admin() or (volunteer_id = auth.uid() and is_active_user() and is_assigned_to(student_id)));
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

-- ----------------------------------------------------------------------------
-- STUDENT ROADMAP POSITIONS
-- Leader-set STARTING BASELINE for a student's roadmap topic per subject —
-- not a permanent pin. Automatic recommendation still advances the student
-- forward from this point once progress is recorded (see
-- resolveRoadmapPosition in the app). Does not touch the append-only
-- `progress` ledger. At most one row per (student_id, subject); absence of
-- a row means "use automatic recommendation from actual progress alone".
-- ----------------------------------------------------------------------------
create table student_roadmap_positions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,
  subject       subject not null,
  roadmap_id    uuid not null references learning_roadmap (id) on delete cascade,
  set_by        uuid references volunteers (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, subject)
);

create index idx_student_roadmap_positions_student on student_roadmap_positions (student_id);
create index idx_student_roadmap_positions_roadmap on student_roadmap_positions (roadmap_id);

create or replace function touch_student_roadmap_position_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_student_roadmap_position
before update on student_roadmap_positions
for each row execute function touch_student_roadmap_position_updated_at();

alter table student_roadmap_positions enable row level security;

create policy "student_roadmap_positions_select_all" on student_roadmap_positions for select
  using (auth.role() = 'authenticated');

create policy "student_roadmap_positions_admin_write" on student_roadmap_positions for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- SUPABASE STORAGE — volunteer profile photos
-- Public-read bucket (profile photos aren't sensitive); writes are locked to
-- the volunteer's own folder ("<volunteer_id>/<file>") or an admin. See
-- supabase/migrations/006_volunteer_profile_fields.sql for the full
-- rationale and components/profile/AvatarUploader.tsx for the client side.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_or_admin_insert" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "avatars_owner_or_admin_update" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "avatars_owner_or_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ----------------------------------------------------------------------------
-- LEARNING CIRCLES + DEBRIEF VERIFICATION
-- A Learning Circle (LC) is a named group of existing volunteers led by one
-- admin. Debriefs filed by a circle's members land as 'pending' and are only
-- "recorded" (visible to latest_progress, students_needing_revision, and the
-- roadmap continuity engine) once that circle's lead admin verifies them.
--
-- Verification is opt-in per volunteer: `verification_status` defaults to
-- 'verified', so a volunteer who is in no circle keeps the original
-- zero-friction flow, and an org that never creates a circle sees no change.
--
-- This block mirrors supabase/migrations/008_learning_circles.sql, which is
-- what existing projects should run. See that file for the full rationale.
-- ----------------------------------------------------------------------------
create type debrief_verification_status as enum ('pending', 'verified', 'rejected');

create table learning_circles (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(trim(name)) between 1 and 120),
  description    text check (char_length(description) <= 1000),
  -- on delete restrict: a circle with no lead has nobody who can verify its
  -- debriefs, so they would pile up pending forever.
  lead_admin_id  uuid not null references volunteers (id) on delete restrict,
  created_by     uuid references volunteers (id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index idx_learning_circles_active_name
  on learning_circles (lower(trim(name))) where is_active;
create index idx_learning_circles_lead on learning_circles (lead_admin_id);

create table learning_circle_members (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references learning_circles (id) on delete cascade,
  volunteer_id  uuid not null references volunteers (id) on delete cascade,
  added_by      uuid references volunteers (id) on delete set null,
  added_at      timestamptz not null default now(),
  -- One circle per volunteer: guarantees each debrief has exactly one
  -- unambiguous verifier.
  unique (volunteer_id),
  unique (circle_id, volunteer_id)
);

create index idx_learning_circle_members_circle on learning_circle_members (circle_id);

alter table progress
  add column verification_status debrief_verification_status not null default 'verified',
  add column learning_circle_id  uuid references learning_circles (id) on delete set null,
  add column verified_by         uuid references volunteers (id) on delete set null,
  add column verified_at         timestamptz,
  add column verification_notes  text check (char_length(verification_notes) <= 1000);

create index idx_progress_verification on progress (verification_status, created_at desc);
create index idx_progress_pending_circle
  on progress (learning_circle_id, created_at desc) where verification_status = 'pending';

create or replace function volunteer_active_circle(p_volunteer_id uuid)
returns uuid language sql security definer stable as $$
  select m.circle_id
  from learning_circle_members m
  join learning_circles c on c.id = m.circle_id
  where m.volunteer_id = p_volunteer_id and c.is_active
  limit 1;
$$;

create or replace function is_circle_lead(p_circle_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from learning_circles
    where id = p_circle_id and lead_admin_id = auth.uid()
  );
$$;

create or replace function ensure_circle_lead_is_admin()
returns trigger language plpgsql security definer as $$
begin
  if not exists (
    select 1 from volunteers where id = new.lead_admin_id and role = 'admin' and is_active
  ) then
    raise exception 'The lead of a Learning Circle must be an active admin.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_learning_circle_lead_must_be_admin
before insert or update of lead_admin_id on learning_circles
for each row execute function ensure_circle_lead_is_admin();

-- Derives verification state server-side and overwrites whatever the client
-- sent — `progress` is directly writable over the REST API, so this cannot
-- live in the app layer alone.
create or replace function stamp_progress_verification()
returns trigger language plpgsql security definer as $$
declare
  v_circle uuid;
  v_is_lead boolean;
begin
  v_circle := volunteer_active_circle(new.volunteer_id);

  if v_circle is null then
    new.learning_circle_id  := null;
    new.verification_status := 'verified';
    new.verified_by         := null;
    new.verified_at         := null;
    new.verification_notes  := null;
    return new;
  end if;

  select (lead_admin_id = new.volunteer_id) into v_is_lead
  from learning_circles where id = v_circle;

  new.learning_circle_id := v_circle;

  -- A lead who is also a member has nobody above them; self-verification is
  -- a no-op ritual, so their debriefs record immediately.
  if coalesce(v_is_lead, false) then
    new.verification_status := 'verified';
    new.verified_by         := new.volunteer_id;
    new.verified_at         := now();
  else
    new.verification_status := 'pending';
    new.verified_by         := null;
    new.verified_at         := null;
    new.verification_notes  := null;
  end if;

  return new;
end;
$$;

create trigger trg_stamp_progress_verification
before insert on progress
for each row execute function stamp_progress_verification();

create or replace function guard_debrief_verification()
returns trigger language plpgsql security definer as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.learning_circle_id is distinct from old.learning_circle_id then
    raise exception 'A debrief''s Learning Circle cannot be changed after it is filed.'
      using errcode = '42501';
  end if;

  if new.verification_status is distinct from old.verification_status then
    if old.learning_circle_id is null then
      if not is_admin() then
        raise exception 'Only an admin can change a debrief''s verification status.'
          using errcode = '42501';
      end if;
    elsif not is_circle_lead(old.learning_circle_id) then
      raise exception 'Only the lead admin of this Learning Circle can verify its debriefs.'
        using errcode = '42501';
    end if;

    if new.verification_status = 'pending' then
      new.verified_by := null;
      new.verified_at := null;
    else
      new.verified_by := auth.uid();
      new.verified_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_guard_debrief_verification
before update on progress
for each row execute function guard_debrief_verification();

create or replace function touch_learning_circle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_learning_circle
before update on learning_circles
for each row execute function touch_learning_circle_updated_at();

alter table learning_circles enable row level security;
alter table learning_circle_members enable row level security;

create policy "learning_circles_select_all" on learning_circles for select
  using (auth.role() = 'authenticated');
create policy "learning_circles_admin_write" on learning_circles for all
  using (is_admin()) with check (is_admin());

create policy "learning_circle_members_select_all" on learning_circle_members for select
  using (auth.role() = 'authenticated');
create policy "learning_circle_members_admin_write" on learning_circle_members for all
  using (is_admin()) with check (is_admin());

-- Recreate both progress views so "recorded" means "verified". Declared
-- earlier in this file against the pre-verification `progress` shape;
-- dropping and recreating avoids `create or replace view`'s
-- cannot-change-column-name restriction (see migration 006).
drop view if exists latest_progress;
create view latest_progress as
select distinct on (p.student_id)
  p.*,
  coalesce(v.preferred_name, v.name) as volunteer_name
from progress p
join volunteers v on v.id = p.volunteer_id
where p.verification_status = 'verified'
order by p.student_id, p.created_at desc;

drop view if exists students_needing_revision;
create view students_needing_revision as
with ranked as (
  select
    p.*,
    row_number() over (partition by p.student_id order by p.created_at desc) as rn
  from progress p
  where p.verification_status = 'verified'
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
-- EFFORT SCORE LEADERBOARD
-- Four read-only views computing the Weekly Effort Score leaderboard
-- server-side (AVG/COUNT grouped by student, or by student+circle) rather
-- than the app fetching every student's progress history and reducing it
-- in JS. Depends on `learning_circles` and `progress.verification_status`
-- above, so this block — like the verified-only
-- latest_progress/students_needing_revision views just above — has to live
-- here, after both exist. This block mirrors
-- supabase/migrations/011_effort_score.sql; see that file for the full
-- rationale (why one column vs a new table, why the "All Students" scope's
-- displayed circle is derived rather than a direct relationship, why a
-- single circle's own leaderboard is a separate aggregation instead, why
-- unverified rows never count).
-- ----------------------------------------------------------------------------

-- All effort views below are created WITH (security_invoker = true): a
-- plain view runs RLS checks on the tables it reads as the view's OWNER,
-- not the querying role, so without security_invoker these views would
-- silently bypass `progress`/`students`/`learning_circles`'s
-- `authenticated`-only select policies and leak the leaderboard to `anon`.
-- See supabase/migrations/011_effort_score.sql for the full rationale.

-- One row per student with at least one rated, VERIFIED session. A student
-- with no rated sessions has no row here — the app must never render a
-- missing row as "0/10".
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

-- The Learning Circle credited with each rated student's most recent rated,
-- verified session (null if that session's author belonged to no circle).
-- Students don't belong to a Learning Circle directly in this schema — only
-- volunteers do (learning_circle_members) — so this reuses the existing
-- relationship via progress.learning_circle_id rather than inventing one.
-- Used ONLY as a display label on the "All Students" leaderboard scope; a
-- single circle's own leaderboard is computed by
-- student_effort_leaderboard_by_circle below, not from this view.
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

-- Ready-to-render "All Students" Effort Leaderboard rows: active students
-- with at least one rated, verified session anywhere in the org. Callers
-- order by average_effort_score DESC, effort_score_count DESC.
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

-- A single Learning Circle's leaderboard aggregates directly from the
-- verified, rated `progress` rows that actually belong to that circle
-- (progress.learning_circle_id, snapshotted at insert time — migration
-- 008), grouped by student — NOT a filter over student_effort_leaderboard's
-- "credited circle" above, which would misattribute a student's whole
-- history to whichever circle happened to submit their latest session. A
-- student taught through more than one circle legitimately gets one row
-- (and one average) per circle here, and can appear on more than one
-- circle's leaderboard. See migration 011 for the full rationale.
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

-- ----------------------------------------------------------------------------
-- ADMIN EDIT TRAIL ON PROGRESS
-- Admins may correct a debrief's taught content (progress_admin_write
-- already permits this). These columns record who last did so and when,
-- stamped server-side by trigger (never client input) — mirrors the
-- verified_by/verified_at pattern above. See
-- supabase/migrations/009_progress_edit_trail.sql for full rationale.
-- ----------------------------------------------------------------------------
alter table progress
  add column edited_by uuid references volunteers (id) on delete set null,
  add column edited_at timestamptz;

create or replace function stamp_progress_edit()
returns trigger language plpgsql security definer as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.english_topic         is distinct from old.english_topic
  or new.english_status        is distinct from old.english_status
  or new.english_roadmap_id    is distinct from old.english_roadmap_id
  or new.math_topic            is distinct from old.math_topic
  or new.math_status           is distinct from old.math_status
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

create trigger trg_stamp_progress_edit
before update on progress
for each row execute function stamp_progress_edit();

-- ----------------------------------------------------------------------------
-- VOLUNTEER HARD-DELETE PURGE
-- progress.volunteer_id and learning_circles.lead_admin_id are ON DELETE
-- RESTRICT on purpose (debrief authorship / circle leadership must not
-- silently vanish), so deleting a volunteer's auth.users row always fails
-- with a foreign-key-violation unless something else handles it first.
-- purge_volunteer() is that "something else", for genuine legal erasure
-- requests only — admins should deactivate by default (reversible,
-- preserves history). This block mirrors
-- supabase/migrations/010_enforce_deactivation_and_purge.sql, which is
-- what existing projects should run. See that file for the full rationale.
-- ----------------------------------------------------------------------------

-- Reserved tombstone volunteer: authored progress rows get reassigned here
-- on purge instead of being deleted, so debrief history and the
-- verification chain survive real erasure. volunteers.id references
-- auth.users(id), so both rows are required; both inserts are idempotent.
insert into auth.users (id, email)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'former-volunteer@edutrack.internal')
on conflict (id) do nothing;

insert into volunteers (id, name, email, role, is_active)
values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Former volunteer',
  'former-volunteer@edutrack.internal',
  'volunteer',
  false
)
on conflict (id) do nothing;

create or replace function purge_volunteer(p_volunteer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tombstone_id constant uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'purge_volunteer can only be called with the service-role key.' using errcode = '42501';
  end if;

  if p_volunteer_id = v_tombstone_id then
    raise exception 'Cannot purge the reserved "Former volunteer" tombstone row.' using errcode = '42501';
  end if;

  if exists (
    select 1 from learning_circles where lead_admin_id = p_volunteer_id and is_active
  ) then
    raise exception 'This volunteer still leads an active Learning Circle — reassign its lead before purging.' using errcode = '23514';
  end if;

  update progress set volunteer_id = v_tombstone_id where volunteer_id = p_volunteer_id;

  -- Every other volunteer back-reference is already ON DELETE SET NULL, so
  -- the delete below would null these out on its own — doing it explicitly
  -- here first makes this function's full effect visible in one place.
  update assignments set assigned_by = null where assigned_by = p_volunteer_id;
  update attendance set marked_by = null where marked_by = p_volunteer_id;
  update student_roadmap_positions set set_by = null where set_by = p_volunteer_id;
  update learning_circle_members set added_by = null where added_by = p_volunteer_id;
  update learning_circles set created_by = null where created_by = p_volunteer_id;
  update progress set verified_by = null where verified_by = p_volunteer_id;
  update progress set edited_by = null where edited_by = p_volunteer_id;

  delete from volunteers where id = p_volunteer_id;
  delete from auth.users where id = p_volunteer_id;
end;
$$;

comment on function purge_volunteer(uuid) is
  'Hard-delete for genuine legal erasure requests only — admins should deactivate by default, which is reversible and preserves history. Callable only with the service-role key. Refuses if the volunteer still leads an active Learning Circle. Reassigns their authored progress rows to the reserved "Former volunteer" tombstone instead of deleting them; other volunteer back-references are nulled out explicitly before the row is deleted.';

revoke execute on function purge_volunteer(uuid) from public, anon, authenticated;
grant execute on function purge_volunteer(uuid) to service_role;
