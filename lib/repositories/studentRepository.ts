import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Student } from "@/lib/types/database";
import type { StudentFormValues } from "@/lib/validations/student";

type Client = SupabaseClient<Database>;

export interface StudentFilters {
  search?: string;
  grade?: number;
  englishLevel?: string;
  mathLevel?: string;
  volunteerId?: string;
}

export const studentRepository = {
  async list(supabase: Client, filters: StudentFilters = {}) {
    let query = supabase.from("students").select("*").eq("is_active", true);

    if (filters.search) query = query.ilike("name", `%${filters.search}%`);
    if (filters.grade) query = query.eq("grade", filters.grade);
    if (filters.englishLevel) query = query.eq("english_level", filters.englishLevel as Student["english_level"]);
    if (filters.mathLevel) query = query.eq("math_level", filters.mathLevel as Student["math_level"]);

    if (filters.volunteerId) {
      const { data: assignmentRows } = await supabase
        .from("assignments")
        .select("student_id")
        .eq("volunteer_id", filters.volunteerId);
      const ids = (assignmentRows ?? []).map((a) => a.student_id);
      if (ids.length === 0) return [];
      query = query.in("id", ids);
    }

    const { data, error } = await query.order("name");
    if (error) throw error;
    return data ?? [];
  },

  async getById(supabase: Client, id: string) {
    const { data, error } = await supabase.from("students").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  async create(supabase: Client, values: StudentFormValues) {
    const { data, error } = await supabase
      .from("students")
      .insert({
        name: values.name,
        grade: values.grade,
        english_level: values.english_level,
        math_level: values.math_level,
        photo_url: values.photo_url || null,
        guardian_name: values.guardian_name || null,
        guardian_phone: values.guardian_phone || null,
        notes: values.notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(supabase: Client, id: string, values: Partial<StudentFormValues>) {
    const { data, error } = await supabase
      .from("students")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async softDelete(supabase: Client, id: string) {
    const { error } = await supabase.from("students").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  },

  async assignedVolunteers(supabase: Client, studentId: string) {
    const { data, error } = await supabase
      .from("assignments")
      .select("volunteer_id, volunteers(*)")
      .eq("student_id", studentId);
    if (error) throw error;
    return (data ?? []).map((row) => row.volunteers).flat();
  },
};
