-- ============================================================================
-- EduTrack — Migration: Volunteer Profile Fields (Preferred Name, Bio, etc.)
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and 001-005) applied.
--
-- ----------------------------------------------------------------------------
-- WHAT THIS ADDS
-- ----------------------------------------------------------------------------
-- Splits the volunteer "card" identity (preferred_name — what everyone sees
-- day to day) from the "formal" identity (name — official/legal, used for
-- attendance exports and admin records). Also adds optional profile fields
-- (bio, teaching_interests, fun_fact, date_of_birth) for the fuller Volunteer
-- Profile view. `avatar_url` already existed on `volunteers` (schema.sql) —
-- this migration does not touch it, it just adds Storage support for it
-- below.
--
-- All new columns are nullable with no default, so every existing volunteer
-- row keeps working unchanged: preferred_name falling back to name is
-- handled in the application layer (see lib/utils.ts -> displayName()), not
-- enforced here.
-- ----------------------------------------------------------------------------

alter table volunteers
  add column if not exists preferred_name text,
  add column if not exists date_of_birth date,
  add column if not exists bio text,
  add column if not exists teaching_interests text,
  add column if not exists fun_fact text;

alter table volunteers
  drop constraint if exists volunteers_preferred_name_length,
  drop constraint if exists volunteers_bio_length,
  drop constraint if exists volunteers_teaching_interests_length,
  drop constraint if exists volunteers_fun_fact_length;

alter table volunteers
  add constraint volunteers_preferred_name_length check (char_length(preferred_name) <= 100),
  add constraint volunteers_bio_length check (char_length(bio) <= 1000),
  add constraint volunteers_teaching_interests_length check (char_length(teaching_interests) <= 500),
  add constraint volunteers_fun_fact_length check (char_length(fun_fact) <= 280);

comment on column volunteers.preferred_name is
  'What the volunteer wants to be called — displayed throughout the normal app UI (greetings, lists, dashboards, cards, Tsareena). Falls back to `name` when null. See displayName() in lib/utils.ts.';
comment on column volunteers.name is
  'Official/legal name. Used for formal records: attendance exports, admin records. Do not blindly replace with preferred_name.';
comment on column volunteers.date_of_birth is
  'For birthday functionality only. Never surface age in the UI — see app/(dashboard)/volunteers/[id]/page.tsx, which shows month/day only, and only to the volunteer themself or an admin.';

-- ----------------------------------------------------------------------------
-- latest_progress view — "last taught by" should read naturally too (a
-- dashboard/card surface), so resolve the same preferred-name-first display
-- name here instead of duplicating the fallback in every consumer.
--
-- The live view predates migrations 003/004 (which added english_roadmap_id,
-- math_roadmap_id, and session_observations to `progress`) and was never
-- recreated against the wider table, so its stored column list is shorter
-- than `p.*` resolves to today. `create or replace view` requires existing
-- column names to stay in their existing positions, so replacing in place
-- fails here with "cannot change name of view column ... to ...". Dropping
-- and recreating sidesteps that — nothing else in the schema references
-- latest_progress (it's a read-only reporting view with no dependents), so
-- this is safe.
-- ----------------------------------------------------------------------------
drop view if exists latest_progress;

create view latest_progress as
select distinct on (p.student_id)
  p.*,
  coalesce(v.preferred_name, v.name) as volunteer_name
from progress p
join volunteers v on v.id = p.volunteer_id
order by p.student_id, p.created_at desc;

-- ----------------------------------------------------------------------------
-- SUPABASE STORAGE — volunteer profile photos
-- Bucket is public-read (profile photos aren't sensitive and this avoids
-- needing signed URLs everywhere they're displayed), but writes are locked
-- to the volunteer's own folder (path convention: "<volunteer_id>/<file>")
-- or an admin. 2 MB hard cap and an image-only allowlist at the bucket level
-- back up the client-side validation in components/profile/AvatarUploader.tsx.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_or_admin_insert" on storage.objects;
create policy "avatars_owner_or_admin_insert" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "avatars_owner_or_admin_update" on storage.objects;
create policy "avatars_owner_or_admin_update" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "avatars_owner_or_admin_delete" on storage.objects;
create policy "avatars_owner_or_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );
