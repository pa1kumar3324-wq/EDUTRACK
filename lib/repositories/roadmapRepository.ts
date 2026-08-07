import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { RoadmapEntryFormValues } from "@/lib/validations/roadmap";

type Client = SupabaseClient<Database>;

export const roadmapRepository = {
  async listByGrade(supabase: Client, grade: number) {
    const { data, error } = await supabase
      .from("learning_roadmap")
      .select("*")
      .eq("grade", grade)
      .order("subject")
      .order("order_index");
    if (error) throw error;
    return data ?? [];
  },

  async listAll(supabase: Client) {
    const { data, error } = await supabase
      .from("learning_roadmap")
      .select("*")
      .order("grade")
      .order("subject")
      .order("order_index");
    if (error) throw error;
    return data ?? [];
  },

  async create(supabase: Client, values: RoadmapEntryFormValues) {
    const { data, error } = await supabase
      .from("learning_roadmap")
      .insert({ ...values, description: values.description || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(supabase: Client, id: string, values: Partial<RoadmapEntryFormValues>) {
    const { data, error } = await supabase
      .from("learning_roadmap")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(supabase: Client, id: string) {
    const { error } = await supabase.from("learning_roadmap").delete().eq("id", id);
    if (error) throw error;
  },
};
