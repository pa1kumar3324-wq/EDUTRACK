import { createClient } from "@/lib/supabase/server";
import type { VolunteerFormValues } from "@/lib/validations/roadmap";
import { normalizeProfilePatch } from "@/lib/validations/volunteerProfile";
import { displayName } from "@/lib/utils";
import { PUBLIC_VOLUNTEER_COLUMNS, type PublicVolunteer } from "@/lib/types/database";

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

  /**
   * Public projection — excludes `phone`/`date_of_birth` (see
   * `PublicVolunteer`). Use this for any caller that doesn't specifically
   * need the full row for an admin-gated view (H1).
   */
  async listPublic(supabase: Client): Promise<PublicVolunteer[]> {
    const { data, error } = await supabase
      .from("volunteers")
      .select(PUBLIC_VOLUNTEER_COLUMNS)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []) as unknown as PublicVolunteer[];
  },

  /**
   * Full roster including deactivated volunteers — used only by the admin
   * People > Volunteers table, which needs to show (and offer to
   * reactivate) deactivated accounts. Every other caller keeps using
   * list()/listPublic(), which filter to is_active=true on purpose (e.g.
   * assignment pickers should never offer a deactivated volunteer).
   */
  async listAll(supabase: Client) {
    const { data, error } = await supabase.from("volunteers").select("*").order("name");
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
    // null normalization here; name/email/phone/role/is_active pass
    // through as-is (is_active must NOT fall into normalizeProfilePatch's
    // spread below — it only walks a fixed list of string profile fields,
    // so a boolean landing there would silently be dropped, not saved).
    const { name, email, phone, role, is_active, ...profileFields } = values;
    const payload = {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
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
