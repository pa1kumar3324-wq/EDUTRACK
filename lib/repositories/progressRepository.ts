import { createClient } from "@/lib/supabase/server";
import type { Database, Progress } from "@/lib/types/database";
import type { ProgressFormValues } from "@/lib/validations/progress";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * `progress` has TWO foreign keys to `volunteers` since migration 008
 * (`volunteer_id` — who taught — and `verified_by` — which lead admin
 * recorded it). A bare `volunteers(...)` embed is therefore ambiguous and
 * PostgREST rejects it, so every embed below names its constraint
 * explicitly. Don't reintroduce the shorthand.
 */
const AUTHOR = "volunteers!progress_volunteer_id_fkey(name, preferred_name)";
const VERIFIER = "verifier:volunteers!progress_verified_by_fkey(name, preferred_name)";
const EDITOR = "editor:volunteers!progress_edited_by_fkey(name, preferred_name)";
const CIRCLE = "learning_circles!progress_learning_circle_id_fkey(id, name)";

export const progressRepository = {
  /**
   * Full debrief history for a student — including entries still pending
   * verification, so the volunteer who filed one can see it sitting in the
   * queue rather than wondering whether it saved.
   *
   * Callers that need the *recorded* record (roadmap continuity, levels,
   * analytics) must filter to verified first — use verifiedOnly() below
   * rather than passing this straight through.
   */
  async listForStudent(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("progress")
      .select(`*, ${AUTHOR}, ${VERIFIER}, ${EDITOR}, ${CIRCLE}`)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Verified-only history — the subset that counts. */
  async listVerifiedForStudent(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("progress")
      .select(`*, ${AUTHOR}`)
      .eq("student_id", studentId)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async latestForStudent(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("latest_progress")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async latestForAllStudents(supabase: Client) {
    const { data, error } = await supabase.from("latest_progress").select("*");
    if (error) throw error;
    return data ?? [];
  },

  /** Recent activity feed — verified only, so the admin overview reflects
   * what has actually been recorded rather than what's still in review. */
  async recent(supabase: Client, limit = 10) {
    const { data, error } = await supabase
      .from("progress")
      .select(`*, students(name), ${AUTHOR}`)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async create(
    supabase: Client,
    values: ProgressFormValues & {
      volunteer_id: string;
      suggested_next_lesson?: string;
      english_roadmap_id?: string | null;
      math_roadmap_id?: string | null;
    }
  ) {
    const payload: Database["public"]["Tables"]["progress"]["Insert"] = {
      student_id: values.student_id,
      volunteer_id: values.volunteer_id,
      english_topic: values.english_topic || null,
      english_status: values.english_status || null,
      english_roadmap_id: values.english_roadmap_id ?? null,
      math_topic: values.math_topic || null,
      math_status: values.math_status || null,
      math_roadmap_id: values.math_roadmap_id ?? null,
      homework: values.homework || null,
      notes: values.notes || null,
      suggested_next_lesson: values.suggested_next_lesson || null,
      effort_score: values.effort_score ?? null,
      session_observations:
        values.session_observations && Object.keys(values.session_observations).length > 0
          ? (values.session_observations as Database["public"]["Tables"]["progress"]["Insert"]["session_observations"])
          : null,
    };
    const { data, error } = await supabase.from("progress").insert(payload).select().single();
    if (error) throw error;
    return data as Progress;
  },

  async needingRevision(supabase: Client) {
    const { data, error } = await supabase.from("students_needing_revision").select("*");
    if (error) throw error;
    return data ?? [];
  },

  /** A single debrief by id, joined the same way listForStudent is — used by the admin edit route to load current values and re-derive suggestions after a save. */
  async getById(supabase: Client, id: string) {
    const { data, error } = await supabase
      .from("progress")
      .select(`*, ${AUTHOR}, ${VERIFIER}, ${EDITOR}, ${CIRCLE}`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Admin correction of an existing debrief's taught content — topic,
   * status, homework, notes. Deliberately narrower than `create`: it never
   * touches `verification_status`, `learning_circle_id`, `verified_by`, or
   * `verified_at` (those are owned by the verification flow in
   * learningCircleRepository / trg_guard_debrief_verification), and
   * `volunteer_id`/`student_id`/`created_at` are immutable — this is a
   * content fix, not a way to reassign whose session it was or when it
   * happened.
   *
   * `edited_by`/`edited_at` are NOT set here — trg_stamp_progress_edit
   * (migration 009, extended by migration 011 to also watch effort_score)
   * derives them from auth.uid()/now() whenever a content field actually
   * changes, so the audit trail reflects who Postgres saw rather than what
   * this process claims.
   */
  async update(
    supabase: Client,
    id: string,
    patch: Partial<{
      english_topic: string | null;
      english_status: Database["public"]["Enums"]["understanding_status"] | null;
      english_roadmap_id: string | null;
      math_topic: string | null;
      math_status: Database["public"]["Enums"]["understanding_status"] | null;
      math_roadmap_id: string | null;
      homework: string | null;
      notes: string | null;
      effort_score: number;
    }>
  ) {
    const { data, error } = await supabase
      .from("progress")
      .update(patch)
      .eq("id", id)
      .select(`*, ${AUTHOR}, ${VERIFIER}, ${EDITOR}, ${CIRCLE}`)
      .single();
    if (error) throw error;
    return data;
  },
};
