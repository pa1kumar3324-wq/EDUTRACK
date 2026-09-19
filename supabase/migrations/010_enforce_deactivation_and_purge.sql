-- ============================================================================
-- EduTrack — Migration 010: Enforce volunteer deactivation + hard-delete purge
-- Run once against an existing project that already has 001-009 applied.
--
-- ----------------------------------------------------------------------------
-- DEFECT 1: `is_active = false` was not enforced anywhere
-- ----------------------------------------------------------------------------
-- Deactivating a volunteer (`volunteers.is_active = false`) only ever hid
-- them from volunteerRepository.list()/listPublic() — it was never checked
-- by auth (lib/auth.ts, lib/api/requireAuth.ts, middleware), and RLS itself
-- had no opinion on it either. A deactivated volunteer could keep using the
-- entire app, and — this is the part app-layer checks alone can never fix —
-- could keep writing directly over PostgREST with a still-valid session,
-- since RLS is enforced by Postgres itself and doesn't go through Next.js
-- at all.
--
-- This migration closes the RLS side of that gap:
--
--   * is_admin() now also requires is_active, so a deactivated admin loses
--     admin-level write access over the REST API, not just in the app.
--   * A new is_active_user() helper, required by the write policies an
--     ordinary volunteer can reach directly: progress_insert_own_assignment
--     (filing a debrief) and volunteers_self_update (editing their own
--     profile).
--   * is_assigned_to() now also requires the *assignment's* volunteer to be
--     active — otherwise a deactivated volunteer's old assignments would
--     keep satisfying progress_insert_own_assignment's is_assigned_to()
--     check even after is_active_user() was added, since that check is
--     independent of who's currently calling.
--
-- migration 005's trigger (prevent_volunteer_privilege_escalation) already
-- stops a volunteer flipping their own is_active — untouched here — and the
-- service_role exemption every one of these functions/policies relies on
-- (the invite flow in POST /api/volunteers, scripts/seed.ts) keeps working
-- unchanged: service_role bypasses RLS entirely, so none of these policies
-- apply to it in the first place.
--
-- The app-layer side of this fix (lib/auth.ts, lib/api/requireAuth.ts,
-- lib/supabase/middleware.ts, and revoking live sessions on deactivate via
-- DELETE /api/volunteers/[id]) ships alongside this migration but lives in
-- application code, not here.
--
-- ----------------------------------------------------------------------------
-- DEFECT 2: deleting the user in Supabase Auth failed
-- ----------------------------------------------------------------------------
-- `on delete cascade` from auth.users reaches volunteers, but
-- progress.volunteer_id and learning_circles.lead_admin_id are
-- `on delete restrict` — intentionally: debrief authorship and circle
-- leadership must not silently vanish. Deleting a volunteer's auth.users
-- row therefore always aborted with a foreign-key-violation database error.
--
-- RESTRICT stays exactly as-is — this migration does NOT relax either
-- constraint to CASCADE or SET NULL. Instead it adds purge_volunteer(),
-- a documented hard-delete procedure for genuine erasure requests:
--
--   * Admins should deactivate by default (PATCH /api/volunteers/:id with
--     `{ is_active: false }`, or the Deactivate action in the Volunteers
--     panel) — that's reversible and preserves history.
--   * purge_volunteer() is only for legal/GDPR-style erasure requests,
--     where the volunteer's row must genuinely stop existing. It:
--       - refuses if the volunteer still leads any active Learning Circle
--         (reassign the lead first — same reason the FK is RESTRICT: a
--         circle with no lead has nobody who can verify its debriefs);
--       - anonymizes rather than deletes their authored progress rows, by
--         reassigning volunteer_id to a reserved "Former volunteer"
--         tombstone row (created idempotently below), so debrief history
--         and the verification chain survive;
--       - nulls out the other volunteer back-references (already ON DELETE
--         SET NULL, so this is explicit rather than left implicit — see
--         the function body for why);
--       - deletes the volunteers row, then the auth.users row, in that
--         order, in one transaction.
--   * Callable only with the service-role key — never exposed to the app
--     or the browser. There is deliberately no API route or UI control for
--     this in the Next.js app; it's meant to be run by an admin/operator
--     directly (Supabase SQL editor or a one-off script), on purpose,
--     given what it does.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1 — RLS: is_active must gate admin/assignment/self-write access
-- ----------------------------------------------------------------------------

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

-- New: the write-policy equivalent of is_admin()'s is_active check, for
-- policies that gate on "is this the volunteer's own row/data" rather than
-- "is this an admin". is_admin() already folds is_active into its own
-- check by construction; this gives the self-service policies below the
-- same guarantee without duplicating that exists(...) query inline.
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

comment on function is_active_user() is
  'True if the calling volunteer (auth.uid()) has is_active = true. Required by write policies an ordinary (non-admin) volunteer can reach directly — see progress_insert_own_assignment and volunteers_self_update.';

drop policy if exists "progress_insert_own_assignment" on progress;
create policy "progress_insert_own_assignment" on progress for insert
  with check (is_admin() or (volunteer_id = auth.uid() and is_active_user() and is_assigned_to(student_id)));

drop policy if exists "volunteers_self_update" on volunteers;
create policy "volunteers_self_update" on volunteers for update
  using (id = auth.uid() and is_active_user()) with check (id = auth.uid() and is_active_user());

-- ----------------------------------------------------------------------------
-- PART 2 — Hard-delete purge for genuine erasure requests
-- ----------------------------------------------------------------------------

-- Reserved tombstone volunteer: authored progress rows get reassigned here
-- on purge, instead of being deleted, so debrief history and the
-- verification chain (verified_by/edited_by on OTHER rows pointing at the
-- purged volunteer already survive via ON DELETE SET NULL — see PART 2
-- below) survive real erasure. volunteers.id references auth.users(id), so
-- both rows are required; both inserts are idempotent (on conflict do
-- nothing) so re-running this migration is always safe.
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

comment on table volunteers is
  'Every user of the system: admins and volunteers alike, distinguished by role. The row with id ffffffff-ffff-ffff-ffff-ffffffffffff is a reserved tombstone (see purge_volunteer()) — never a real volunteer, never surfaced to invite/assignment flows because is_active = false excludes it from list()/listPublic() like any other deactivated row.';

create or replace function purge_volunteer(p_volunteer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tombstone_id constant uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
begin
  -- Hard erasure is irreversible and bypasses RESTRICT constraints that
  -- exist on purpose — never callable from the app or the browser, and
  -- REVOKE/GRANT below backs this up at the privilege level, not just here.
  if auth.role() is distinct from 'service_role' then
    raise exception 'purge_volunteer can only be called with the service-role key.' using errcode = '42501';
  end if;

  if p_volunteer_id = v_tombstone_id then
    raise exception 'Cannot purge the reserved "Former volunteer" tombstone row.' using errcode = '42501';
  end if;

  -- learning_circles.lead_admin_id is ON DELETE RESTRICT for exactly this
  -- reason: a circle with no lead has nobody who can verify its debriefs.
  -- Surface that as a clear, actionable message instead of letting the
  -- delete below fail on the FK constraint.
  if exists (
    select 1 from learning_circles where lead_admin_id = p_volunteer_id and is_active
  ) then
    raise exception 'This volunteer still leads an active Learning Circle — reassign its lead before purging.' using errcode = '23514';
  end if;

  -- progress.volunteer_id is ON DELETE RESTRICT for the same reason
  -- (debrief authorship must not silently vanish). Anonymize instead of
  -- delete: reassign authored rows to the tombstone so debrief history and
  -- the continuity/verification engine keep working.
  update progress set volunteer_id = v_tombstone_id where volunteer_id = p_volunteer_id;

  -- Every other volunteer back-reference is already ON DELETE SET NULL, so
  -- the `delete from volunteers` below would null these out on its own —
  -- nulling them explicitly here first just makes this function's full
  -- effect visible in one place, rather than depending on FK action
  -- ordering that isn't obvious from reading this function alone.
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
  'Hard-delete for genuine legal erasure requests only — admins should deactivate by default (DELETE /api/volunteers/:id, or PATCH with { is_active: false }), which is reversible and preserves history. Callable only with the service-role key. Refuses if the volunteer still leads an active Learning Circle. Reassigns their authored progress rows to the reserved "Former volunteer" tombstone instead of deleting them, so debrief history and the verification chain survive; other volunteer back-references are nulled out explicitly before the row is deleted.';

-- Belt-and-suspenders on top of the auth.role() check inside the function
-- body: a security definer function is executable by PUBLIC by default,
-- which would otherwise let any authenticated/anon caller invoke it (the
-- runtime check would still block them, but there's no reason to leave the
-- grant open for a function this destructive).
revoke execute on function purge_volunteer(uuid) from public, anon, authenticated;
grant execute on function purge_volunteer(uuid) to service_role;
