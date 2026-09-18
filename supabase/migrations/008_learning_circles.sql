-- ============================================================================
-- EduTrack — Migration 008: Learning Circles + Debrief Verification
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and 001-007) applied.
--
-- ----------------------------------------------------------------------------
-- WHAT THIS ADDS
-- ----------------------------------------------------------------------------
-- A "Learning Circle" (LC) is a named group of existing volunteers with one
-- admin as its lead. When a volunteer who belongs to an active LC files a
-- class debrief (a row in `progress`), that debrief lands as PENDING rather
-- than immediately counting. The LC's lead admin then verifies it — and only
-- on verification is the debrief "recorded": counted by latest_progress, by
-- the revision/staleness view, and by the roadmap continuity engine.
--
-- ----------------------------------------------------------------------------
-- BACKWARDS COMPATIBILITY — the load-bearing design decision
-- ----------------------------------------------------------------------------
-- `progress.verification_status` defaults to 'verified', NOT 'pending'.
-- That means:
--   * every pre-existing progress row is verified by the backfill below and
--     keeps behaving exactly as it does today;
--   * every volunteer who is NOT in a Learning Circle keeps the old
--     zero-friction flow — their debrief is recorded the instant they
--     submit it, with no admin in the loop.
-- Verification is therefore strictly opt-in, per volunteer, by putting them
-- in a Learning Circle. An org that never creates an LC sees no change at
-- all.
--
-- ----------------------------------------------------------------------------
-- WHERE THE RULES LIVE
-- ----------------------------------------------------------------------------
-- Triggers, not just the API layer. `progress` is writable directly over the
-- Supabase REST API by any authenticated volunteer for their own assigned
-- students (policy "progress_insert_own_assignment"), so a rule enforced
-- only in app/api/progress/route.ts could be bypassed with a raw POST. The
-- BEFORE INSERT trigger below *derives* the verification status and owning
-- circle server-side and overwrites whatever the client sent; the BEFORE
-- UPDATE trigger gates who may flip that status. This is the same reasoning
-- as migration 005's privilege-escalation guard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'debrief_verification_status') then
    create type debrief_verification_status as enum ('pending', 'verified', 'rejected');
  end if;
end
$$;

comment on type debrief_verification_status is
  'Lifecycle of a class debrief: pending (filed by a Learning Circle member, awaiting its lead admin), verified (recorded — counts everywhere), rejected (sent back; retained for audit but never counted).';

-- ----------------------------------------------------------------------------
-- LEARNING CIRCLES
-- ----------------------------------------------------------------------------
create table if not exists learning_circles (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(trim(name)) between 1 and 120),
  description    text check (char_length(description) <= 1000),
  -- The admin responsible for verifying this circle's debriefs. `on delete
  -- restrict` is deliberate: a circle with no lead has no one who can
  -- verify its debriefs, so they would pile up pending forever. Reassign
  -- the lead (or deactivate the circle) before removing the volunteer row.
  lead_admin_id  uuid not null references volunteers (id) on delete restrict,
  created_by     uuid references volunteers (id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table learning_circles is
  'A named group of volunteers led by one admin, who verifies the debriefs its members file.';
comment on column learning_circles.lead_admin_id is
  'The ONLY person who can verify/reject this circle''s debriefs (see guard_debrief_verification). Must be a volunteers row with role = ''admin'' — enforced by trg_learning_circle_lead_must_be_admin.';

-- Circle names are how admins tell circles apart in the UI, so keep active
-- ones unique case-insensitively. Deactivated circles are excluded so a
-- name can be reused after a circle is retired.
create unique index if not exists idx_learning_circles_active_name
  on learning_circles (lower(trim(name))) where is_active;

create index if not exists idx_learning_circles_lead on learning_circles (lead_admin_id);

-- ----------------------------------------------------------------------------
-- LEARNING CIRCLE MEMBERS  (existing volunteers added to a circle)
-- ----------------------------------------------------------------------------
create table if not exists learning_circle_members (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references learning_circles (id) on delete cascade,
  volunteer_id  uuid not null references volunteers (id) on delete cascade,
  added_by      uuid references volunteers (id) on delete set null,
  added_at      timestamptz not null default now(),
  -- A volunteer belongs to AT MOST ONE circle. Every debrief must have
  -- exactly one unambiguous verifier; allowing two circles would mean two
  -- lead admins with equal claim on the same debrief and no principled way
  -- to pick one. Moving a volunteer between circles is a delete + insert.
  unique (volunteer_id),
  unique (circle_id, volunteer_id)
);

create index if not exists idx_learning_circle_members_circle on learning_circle_members (circle_id);

comment on constraint learning_circle_members_volunteer_id_key on learning_circle_members is
  'One circle per volunteer — guarantees each debrief has exactly one lead admin who can verify it.';

-- ----------------------------------------------------------------------------
-- PROGRESS — verification columns
-- ----------------------------------------------------------------------------
alter table progress
  add column if not exists verification_status debrief_verification_status not null default 'verified',
  add column if not exists learning_circle_id  uuid references learning_circles (id) on delete set null,
  add column if not exists verified_by         uuid references volunteers (id) on delete set null,
  add column if not exists verified_at         timestamptz,
  add column if not exists verification_notes  text check (char_length(verification_notes) <= 1000);

comment on column progress.verification_status is
  'Defaults to ''verified'' so non-Learning-Circle volunteers (and every pre-008 row) keep the original instant-record behaviour. Set to ''pending'' by trg_stamp_progress_verification when the author belongs to an active circle.';
comment on column progress.learning_circle_id is
  'The circle that owned this debrief at the moment it was filed — snapshotted on insert, so later membership changes never move an in-flight debrief to a different verifier.';
comment on column progress.verified_by is
  'Null for auto-verified rows (no human verification was required) and for pending rows. Set to the acting lead admin when a debrief is verified or rejected.';

-- Backfill: everything that already exists was, by definition, already
-- recorded under the old rules. The column default covers rows inserted
-- between the `add column` and here, but be explicit for clarity.
update progress set verification_status = 'verified' where verification_status is null;

create index if not exists idx_progress_verification
  on progress (verification_status, created_at desc);
-- Partial index: the admin verification queue only ever reads pending rows.
create index if not exists idx_progress_pending_circle
  on progress (learning_circle_id, created_at desc) where verification_status = 'pending';

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- The active circle a given volunteer belongs to, or null.
create or replace function volunteer_active_circle(p_volunteer_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select m.circle_id
  from learning_circle_members m
  join learning_circles c on c.id = m.circle_id
  where m.volunteer_id = p_volunteer_id and c.is_active
  limit 1;
$$;

-- Whether the CURRENT user is the lead admin of the given circle.
create or replace function is_circle_lead(p_circle_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from learning_circles
    where id = p_circle_id and lead_admin_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- TRIGGER: a circle's lead must actually be an admin
-- Guards the invariant the whole feature rests on — a lead who isn't an
-- admin could never reach the verification UI, so their circle's debriefs
-- would be unverifiable.
-- ----------------------------------------------------------------------------
create or replace function ensure_circle_lead_is_admin()
returns trigger
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from volunteers
    where id = new.lead_admin_id and role = 'admin' and is_active
  ) then
    raise exception 'The lead of a Learning Circle must be an active admin.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_learning_circle_lead_must_be_admin on learning_circles;
create trigger trg_learning_circle_lead_must_be_admin
before insert or update of lead_admin_id on learning_circles
for each row execute function ensure_circle_lead_is_admin();

-- ----------------------------------------------------------------------------
-- TRIGGER: derive verification state on insert
-- Runs BEFORE INSERT and OVERWRITES whatever the client supplied for
-- verification_status / learning_circle_id / verified_by / verified_at.
-- These are derived facts, never client input.
-- ----------------------------------------------------------------------------
create or replace function stamp_progress_verification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_circle uuid;
  v_is_lead boolean;
begin
  v_circle := volunteer_active_circle(new.volunteer_id);

  -- Not in a circle -> original behaviour: recorded immediately.
  if v_circle is null then
    new.learning_circle_id  := null;
    new.verification_status := 'verified';
    new.verified_by         := null;
    new.verified_at         := null;
    new.verification_notes  := null;
    return new;
  end if;

  -- A lead admin who is also a member of their own circle has no one above
  -- them to verify against; self-verification is a no-op ritual, so their
  -- debriefs are recorded immediately (but still tagged with the circle).
  select (lead_admin_id = new.volunteer_id) into v_is_lead
  from learning_circles where id = v_circle;

  new.learning_circle_id := v_circle;

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

drop trigger if exists trg_stamp_progress_verification on progress;
create trigger trg_stamp_progress_verification
before insert on progress
for each row execute function stamp_progress_verification();

-- ----------------------------------------------------------------------------
-- TRIGGER: gate who may change a debrief's verification state
-- ----------------------------------------------------------------------------
create or replace function guard_debrief_verification()
returns trigger
language plpgsql
security definer
as $$
begin
  -- service_role (seed script, server-side maintenance) bypasses RLS by
  -- design and has no auth.uid() to check — exempt it, same as migration
  -- 005 does.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- The owning circle is snapshotted at insert time and is not reassignable
  -- afterwards: moving an in-flight debrief to another circle would move it
  -- to a verifier who never saw the class.
  if new.learning_circle_id is distinct from old.learning_circle_id then
    raise exception 'A debrief''s Learning Circle cannot be changed after it is filed.'
      using errcode = '42501';
  end if;

  if new.verification_status is distinct from old.verification_status then
    if old.learning_circle_id is null then
      -- Debriefs filed outside any circle are auto-verified and have no
      -- lead admin; only a global admin can touch their state at all.
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

drop trigger if exists trg_guard_debrief_verification on progress;
create trigger trg_guard_debrief_verification
before update on progress
for each row execute function guard_debrief_verification();

-- ----------------------------------------------------------------------------
-- VIEWS — "recorded" now means "verified"
--
-- Both views are recreated to read only verified rows. Because the backfill
-- above marked every existing row verified, this is a no-op for existing
-- data — it only takes effect once a Learning Circle exists and starts
-- producing pending debriefs.
--
-- As migration 006 noted, `create or replace view` cannot reorder or rename
-- existing columns, and `p.*` is wider now than when these views were last
-- created, so drop and recreate rather than replace in place.
-- ----------------------------------------------------------------------------
drop view if exists latest_progress;
create view latest_progress as
select distinct on (p.student_id)
  p.*,
  coalesce(v.preferred_name, v.name) as volunteer_name
from progress p
join volunteers v on v.id = p.volunteer_id
where p.verification_status = 'verified'
order by p.student_id, p.created_at desc;

comment on view latest_progress is
  'Most recent VERIFIED debrief per student. Pending debriefs are deliberately invisible here — a debrief is not "recorded" until its Learning Circle lead verifies it.';

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
-- ROW LEVEL SECURITY
-- Circles and membership are readable by any authenticated user (a volunteer
-- should be able to see which circle they're in and who leads it — same
-- rationale as assignments_select_all); only admins manage them.
-- ----------------------------------------------------------------------------
alter table learning_circles enable row level security;
alter table learning_circle_members enable row level security;

drop policy if exists "learning_circles_select_all" on learning_circles;
create policy "learning_circles_select_all" on learning_circles for select
  using (auth.role() = 'authenticated');

drop policy if exists "learning_circles_admin_write" on learning_circles;
create policy "learning_circles_admin_write" on learning_circles for all
  using (is_admin()) with check (is_admin());

drop policy if exists "learning_circle_members_select_all" on learning_circle_members;
create policy "learning_circle_members_select_all" on learning_circle_members for select
  using (auth.role() = 'authenticated');

drop policy if exists "learning_circle_members_admin_write" on learning_circle_members;
create policy "learning_circle_members_admin_write" on learning_circle_members for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- updated_at touch for circles
-- ----------------------------------------------------------------------------
create or replace function touch_learning_circle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_learning_circle on learning_circles;
create trigger trg_touch_learning_circle
before update on learning_circles
for each row execute function touch_learning_circle_updated_at();
