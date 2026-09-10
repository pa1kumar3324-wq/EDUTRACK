import { createClient } from "@/lib/supabase/server";
import type { VolunteerFormValues } from "@/lib/validations/roadmap";
import { normalizeProfilePatch } from "@/lib/validations/volunteerProfile";
import { displayName } from "@/lib/utils";

type Client = Awaited<ReturnType<typeof createClient>>;

export const volunteerRepository = {
  async list(supabase: Client) {
    const { data, error } = await supabase
      .from("volunteers")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async getById(supabase: Client, id: string) {
    const { data, error } = await supabase.from("volunteers").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  async update(supabase: Client, id: string, values: Partial<VolunteerFormValues>) {
    // Profile fields (preferred_name, bio, etc.) get their empty-string ->
    // null normalization here; name/email/phone/role pass through as-is.
    const { name, email, phone, role, ...profileFields } = values;
    const payload = {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...normalizeProfilePatch(profileFields),
    };
    const { data, error } = await supabase
      .from("volunteers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deactivate(supabase: Client, id: string) {
    const { error } = await supabase.from("volunteers").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  },

  async studentsPerVolunteer(supabase: Client) {
    const { data, error } = await supabase.from("assignments").select("volunteer_id, volunteers!assignments_volunteer_id_fkey(name, preferred_name)");
    if (error) throw error;
    const counts = new Map<string, { name: string; count: number }>();
    for (const row of data ?? []) {
      const name = row.volunteers ? displayName(row.volunteers) : "Unknown";
      const existing = counts.get(row.volunteer_id);
      counts.set(row.volunteer_id, { name, count: (existing?.count ?? 0) + 1 });
    }
    return Array.from(counts.values());
  },
};
