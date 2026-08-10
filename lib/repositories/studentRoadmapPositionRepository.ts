import { createClient } from "@/lib/supabase/server";
import type { Database, Subject, StudentRoadmapPositionWithTopic } from "@/lib/types/database";

type Client = Awaited<ReturnType<typeof createClient>>;

export const studentRoadmapPositionRepository = {
  /** All leader-set starting-baseline positions for a student (both subjects), topic joined in. */
  async listForStudent(supabase: Client, studentId: string): Promise<StudentRoadmapPositionWithTopic[]> {
    const { data, error } = await supabase
      .from("student_roadmap_positions")
      .select("*, learning_roadmap(*)")
      .eq("student_id", studentId);
    if (error) throw error;
    return (data ?? []) as unknown as StudentRoadmapPositionWithTopic[];
  },

  /** One subject's starting-baseline position for a student, or null if automatic tracking applies. */
  async getForStudentSubject(
    supabase: Client,
    studentId: string,
    subject: Subject
  ): Promise<StudentRoadmapPositionWithTopic | null> {
    const { data, error } = await supabase
      .from("student_roadmap_positions")
      .select("*, learning_roadmap(*)")
      .eq("student_id", studentId)
      .eq("subject", subject)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as StudentRoadmapPositionWithTopic | null) ?? null;
  },

  /** Creates or replaces the starting-baseline position for (student_id, subject). Admin-only — enforced by the caller. */
  async upsert(
    supabase: Client,
    values: { student_id: string; subject: Subject; roadmap_id: string },
    setBy: string
  ): Promise<StudentRoadmapPositionWithTopic> {
    const payload: Database["public"]["Tables"]["student_roadmap_positions"]["Insert"] = {
      student_id: values.student_id,
      subject: values.subject,
      roadmap_id: values.roadmap_id,
      set_by: setBy,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("student_roadmap_positions")
      .upsert(payload, { onConflict: "student_id,subject" })
      .select("*, learning_roadmap(*)")
      .single();
    if (error) throw error;
    return data as unknown as StudentRoadmapPositionWithTopic;
  },

  /** Clears the starting-baseline position for (student_id, subject), restoring purely automatic recommendation. */
  async clear(supabase: Client, studentId: string, subject: Subject): Promise<void> {
    const { error } = await supabase
      .from("student_roadmap_positions")
      .delete()
      .eq("student_id", studentId)
      .eq("subject", subject);
    if (error) throw error;
  },
};
