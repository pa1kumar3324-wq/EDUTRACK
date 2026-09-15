import { createClient } from "@/lib/supabase/server";
import { PUBLIC_VOLUNTEER_COLUMNS } from "@/lib/types/database";

type Client = Awaited<ReturnType<typeof createClient>>;

export const assignmentRepository = {
  /** Public volunteer projection only (no phone/date_of_birth) — this is
   * reached by any authenticated user via GET /api/assignments (H1). */
  async listForStudent(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("assignments")
      .select(`*, volunteers!assignments_volunteer_id_fkey(${PUBLIC_VOLUNTEER_COLUMNS})`)
      .eq("student_id", studentId);
    if (error) throw error;
    return data ?? [];
  },

  async assign(supabase: Client, studentId: string, volunteerId: string, assignedBy: string) {
    const { data, error } = await supabase
      .from("assignments")
      .insert({ student_id: studentId, volunteer_id: volunteerId, assigned_by: assignedBy })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async unassign(supabase: Client, studentId: string, volunteerId: string) {
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("student_id", studentId)
      .eq("volunteer_id", volunteerId);
    if (error) throw error;
  },
};
