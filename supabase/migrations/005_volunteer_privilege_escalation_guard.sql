-- ============================================================================
-- EduTrack — Migration: Volunteer Self-Update Privilege-Escalation Guard
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and 001-004) applied.
--
-- ----------------------------------------------------------------------------
-- WHAT WAS VULNERABLE
-- ----------------------------------------------------------------------------
-- supabase/schema.sql defines:
--
--   create policy "volunteers_self_update" on volunteers for update
--     using (id = auth.uid()) with check (id = auth.uid());
--
-- This lets any authenticated volunteer UPDATE their own `volunteers` row —
-- which is correct and intended (it's how a volunteer edits their own
-- profile). The problem is that RLS policies are ROW-level, not
-- COLUMN-level: the policy has no way to say "...but only these columns".
-- As written, a volunteer can issue a direct PostgREST/Supabase request
-- (bypassing the Next.js app and its `requireAdmin()` gate entirely, since
-- RLS is enforced by Postgres itself) that sets their own `role` to
-- 'admin' or flips their own `is_active`, and Postgres would allow it: the
-- row being touched is their own, so `id = auth.uid()` is satisfied.
--
-- ----------------------------------------------------------------------------
-- HOW THIS FIXES IT
-- ----------------------------------------------------------------------------
-- Postgres does support real column-level privileges (GRANT/REVOKE ...
-- (column)), but Supabase's `authenticated` Postgres role is shared by
-- every signed-in user regardless of app-level role (admin vs volunteer)
-- — there is no separate Postgres role per volunteer to attach different
-- column grants to. So the column boundary has to be enforced with logic
-- that can see BOTH "who is making this change" (auth.uid()) AND "which
-- columns are actually changing" (OLD vs NEW) at the same time — which is
-- exactly what a BEFORE UPDATE trigger can do and a plain RLS policy
-- cannot.
--
-- This does not touch or weaken "volunteers_self_update" or
-- "volunteers_admin_write" at all. It adds a second, independent layer
-- underneath them: even if a future policy change accidentally widened
-- self-update access again, this trigger still blocks privilege
-- escalation on its own.
-- ============================================================================

create or replace function prevent_volunteer_privilege_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Requests made with the service-role key (the invite flow in
  -- POST /api/volunteers, and scripts/seed.ts) run as Postgres role
  -- `service_role`, with no user JWT at all — auth.uid() is null in that
  -- context, so is_admin() below would (incorrectly) read as false and
  -- block these already-fully-trusted, server-only operations. The
  -- service-role key is equivalent to direct database access for RLS
  -- purposes (it's what RLS-bypass IS, by design) and is never exposed to
  -- the browser, so it's safe to exempt here the same way RLS itself
  -- already exempts it.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Admins retain full write access via "volunteers_admin_write" — this
  -- guard only needs to constrain the SELF-update path. is_admin() checks
  -- the ACTING user (auth.uid()), not the row being written, so an admin
  -- editing anyone's row (including their own) is unaffected.
  if is_admin() then
    return new;
  end if;

  -- `role` and `is_active` participate directly in authorization —
  -- is_admin() and every policy built on it key off `role`, and a
  -- deactivated volunteer is meant to lose access. An ordinary volunteer
  -- must never be able to change either on their own row, no matter what
  -- the RLS policy that got them here allows at the row level.
  if new.role is distinct from old.role then
    raise exception 'You do not have permission to change your role.' using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'You do not have permission to change your active status.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_volunteer_privilege_escalation on volunteers;
create trigger trg_prevent_volunteer_privilege_escalation
before update on volunteers
for each row execute function prevent_volunteer_privilege_escalation();
