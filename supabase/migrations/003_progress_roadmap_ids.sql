-- ============================================================================
-- EduTrack — Migration: Progress Roadmap Topic IDs
-- Run this once in the Supabase SQL editor against an EXISTING project that
-- already has schema.sql (and 001_attendance.sql, 002_student_roadmap_positions.sql)
-- applied.
--
-- Purely additive: adds two nullable FK columns to `progress` so that, going
-- forward, a progress entry records EXACTLY which learning_roadmap row its
-- topic corresponds to — no case-insensitive string matching needed at read
-- time. No existing `progress` rows are modified; both new columns default
-- to null for them, and recommendNextTopic() falls back to the existing
-- case-insensitive text match only when the relevant *_roadmap_id is null,
-- so historical data keeps working exactly as it does today.
-- ============================================================================

alter table progress
  add column if not exists english_roadmap_id uuid references learning_roadmap (id) on delete set null,
  add column if not exists math_roadmap_id uuid references learning_roadmap (id) on delete set null;

create index if not exists idx_progress_english_roadmap on progress (english_roadmap_id);
create index if not exists idx_progress_math_roadmap on progress (math_roadmap_id);
