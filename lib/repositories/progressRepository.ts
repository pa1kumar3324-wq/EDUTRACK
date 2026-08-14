import { createClient } from "@/lib/supabase/server";
import type { Database, Progress } from "@/lib/types/database";
import type { ProgressFormValues } from "@/lib/validations/progress";

type Client = Awaited<ReturnType<typeof createClient>>;

export const progressRepository = {
  async listForStudent(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("progress")
      .select("*, volunteers(name)")
      .eq("student_id", studentId)
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

  async recent(supabase: Client, limit = 10) {
    const { data, error } = await supabase
      .from("progress")
      .select("*, students(name), volunteers(name)")
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
};
