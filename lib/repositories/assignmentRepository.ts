import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export const assignmentRepository = {
  async listForStudent(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("assignments")
      .select("*, volunteers(*)")
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
