import { createClient } from "@/lib/supabase/server";
import type {
  Attendance,
  AttendanceStatus,
  Database,
} from "@/lib/types/database";
import type {
  AttendanceFormValues,
  BulkAttendanceFormValues,
} from "@/lib/validations/attendance";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number; // present / total, 0-100, rounded
}

function summarize(rows: { status: AttendanceStatus }[]): AttendanceSummary {
  const total = rows.length;
  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const late = rows.filter((r) => r.status === "late").length;
  const excused = rows.filter((r) => r.status === "excused").length;
  return {
    total,
    present,
    absent,
    late,
    excused,
    attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}

export const attendanceRepository = {
  /** For the admin marking UI: everything logged for one session date. */
  async listForDate(supabase: Client, sessionDate: string) {
    const { data, error } = await supabase
      .from("attendance")
      .select("*, volunteers!attendance_volunteer_id_fkey(name, email, avatar_url)")
      .eq("session_date", sessionDate);
    if (error) throw error;
    return data ?? [];
  },

  /** Full history for one volunteer — used for their own pie chart. */
  async listForVolunteer(supabase: Client, volunteerId: string, limit = 200) {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("volunteer_id", volunteerId)
      .order("session_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Attendance[];
  },

  /** Aggregated present/absent/late/excused counts for one volunteer. */
  async summaryForVolunteer(supabase: Client, volunteerId: string): Promise<AttendanceSummary> {
    const rows = await this.listForVolunteer(supabase, volunteerId);
    return summarize(rows);
  },

  /** All records across all volunteers — used for the reports export. */
  async listAll(supabase: Client, filters: { from?: string; to?: string } = {}) {
    let query = supabase
      .from("attendance")
      .select("*, volunteers!attendance_volunteer_id_fkey(name, email)")
      .order("session_date", { ascending: false });
    if (filters.from) query = query.gte("session_date", filters.from);
    if (filters.to) query = query.lte("session_date", filters.to);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /** Marks (creates or updates) one volunteer's attendance for a session date. */
  async mark(supabase: Client, values: AttendanceFormValues, markedBy: string) {
    const payload: Database["public"]["Tables"]["attendance"]["Insert"] = {
      volunteer_id: values.volunteer_id,
      session_date: values.session_date,
      status: values.status,
      notes: values.notes || null,
      marked_by: markedBy,
    };
    const { data, error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "volunteer_id,session_date" })
      .select()
      .single();
    if (error) throw error;
    return data as Attendance;
  },

  /** Marks the same status for several volunteers on one session date at once. */
  async markBulk(supabase: Client, values: BulkAttendanceFormValues, markedBy: string) {
    const payload: Database["public"]["Tables"]["attendance"]["Insert"][] = values.volunteer_ids.map((id) => ({
      volunteer_id: id,
      session_date: values.session_date,
      status: values.status,
      notes: values.notes || null,
      marked_by: markedBy,
    }));
    const { data, error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "volunteer_id,session_date" })
      .select();
    if (error) throw error;
    return (data ?? []) as Attendance[];
  },

  async remove(supabase: Client, id: string) {
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (error) throw error;
  },
};
