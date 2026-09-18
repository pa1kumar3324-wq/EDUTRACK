-- ============================================================================
-- EduTrack — Migration 009: Admin edit trail on `progress`
-- Run once against an existing project that already has 001-008 applied.
--
-- ----------------------------------------------------------------------------
-- WHAT THIS ADDS
-- ----------------------------------------------------------------------------
-- Admins can already correct a debrief's content (wrong topic, mis-typed
-- status, a homework note that needs fixing) via PATCH /api/progress/[id] —
-- `progress_admin_write` already permitted this at the RLS layer before this
-- migration, there just wasn't an audit trail for it. This migration adds
-- one, following the same pattern as migration 008's verification stamps:
--
--   * `edited_by` / `edited_at` — who last corrected this row's taught
--     content, and when. Null until the first edit.
--
-- Like `verified_by`/`verified_at`, these are DERIVED, not client input: a
-- BEFORE UPDATE trigger stamps them from auth.uid()/now() whenever a
-- content field actually changes, so the audit trail reflects who Postgres
-- saw, not what the calling process claimed. `progress_admin_write` has no
-- WITH CHECK beyond `is_admin()`, so without this trigger an admin's raw
-- REST call could set `edited_by` to any volunteer id it liked.
--
-- Editing a debrief does NOT touch `verification_status`,
-- `learning_circle_id`, `verified_by`, or `verified_at` — an admin fixing a
-- typo in a verified debrief doesn't need to re-run it through its
-- Learning Circle lead, and this trigger deliberately only watches the
-- content columns, not the verification ones (trg_guard_debrief_verification
-- from migration 008 already owns those).
-- ============================================================================

alter table progress
  add column if not exists edited_by uuid references volunteers (id) on delete set null,
  add column if not exists edited_at timestamptz;

comment on column progress.edited_by is
  'Admin who last corrected this debrief''s taught content (topic/status/homework/notes), if any. Stamped by trg_stamp_progress_edit from auth.uid() — never client input.';
comment on column progress.edited_at is
  'When progress.edited_by last corrected this row. Null if the debrief has never been edited after creation.';

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
  or new.math_status           is distinct from old.math_status
  or new.math_roadmap_id       is distinct from old.math_roadmap_id
  or new.homework               is distinct from old.homework
  or new.notes                  is distinct from old.notes
  or new.session_observations   is distinct from old.session_observations
  then
    new.edited_by := auth.uid();
    new.edited_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stamp_progress_edit on progress;
create trigger trg_stamp_progress_edit
before update on progress
for each row execute function stamp_progress_edit();
