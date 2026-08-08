import { createClient } from "@/lib/supabase/server";
import type {
  AdminStats,
  DashboardStats,
  LevelDistributionPoint,
  VolunteerActivityPoint,
  WeakTopicPoint,
  WeeklyProgressPoint,
} from "@/lib/types";
import type { Student } from "@/lib/types/database";
import { startOfWeek, subWeeks, format, isToday, differenceInCalendarDays } from "date-fns";

type Client = Awaited<ReturnType<typeof createClient>>;

export const analyticsRepository = {
  async adminStats(supabase: Client): Promise<AdminStats> {
    const [{ count: totalStudents }, { count: totalVolunteers }, { data: progressToday }, revision] =
      await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("volunteers")
          .select("*", { count: "exact", head: true })
          .eq("role", "volunteer")
          .eq("is_active", true),
        supabase.from("progress").select("student_id, created_at"),
        supabase.from("students_needing_revision").select("student_id"),
      ]);

    const updatedTodayIds = new Set(
      (progressToday ?? []).filter((p) => isToday(new Date(p.created_at))).map((p) => p.student_id)
    );

    return {
      totalStudents: totalStudents ?? 0,
      totalVolunteers: totalVolunteers ?? 0,
      studentsUpdatedToday: updatedTodayIds.size,
      studentsNeedingRevision: revision.data?.length ?? 0,
    };
  },

  async dashboardStats(supabase: Client, volunteerId: string): Promise<DashboardStats> {
    const { data: assignments } = await supabase
      .from("assignments")
      .select("student_id")
      .eq("volunteer_id", volunteerId);
    const studentIds = (assignments ?? []).map((a) => a.student_id);

    if (studentIds.length === 0) {
      return { studentsAssigned: 0, studentsUpdatedThisWeek: 0, pendingUpdates: 0, studentsNeedingRevision: 0 };
    }

    const weekStart = startOfWeek(new Date());
    const [{ data: progressRows }, { data: revisionRows }] = await Promise.all([
      supabase.from("progress").select("student_id, created_at").in("student_id", studentIds),
      supabase.from("students_needing_revision").select("student_id").in("student_id", studentIds),
    ]);

    const updatedThisWeek = new Set(
      (progressRows ?? [])
        .filter((p) => new Date(p.created_at) >= weekStart)
        .map((p) => p.student_id)
    );

    const everUpdated = new Set((progressRows ?? []).map((p) => p.student_id));
    const pending = studentIds.filter((id) => !everUpdated.has(id)).length;

    return {
      studentsAssigned: studentIds.length,
      studentsUpdatedThisWeek: updatedThisWeek.size,
      pendingUpdates: pending,
      studentsNeedingRevision: revisionRows?.length ?? 0,
    };
  },

  async weeklyProgress(supabase: Client, weeks = 8): Promise<WeeklyProgressPoint[]> {
    const since = subWeeks(new Date(), weeks);
    const { data, error } = await supabase
      .from("progress")
      .select("created_at")
      .gte("created_at", since.toISOString());
    if (error) throw error;

    const buckets = new Map<string, number>();
    for (let i = weeks - 1; i >= 0; i--) {
      const weekLabel = format(startOfWeek(subWeeks(new Date(), i)), "MMM d");
      buckets.set(weekLabel, 0);
    }
    for (const row of data ?? []) {
      const label = format(startOfWeek(new Date(row.created_at)), "MMM d");
      if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([week, updates]) => ({ week, updates }));
  },

  async levelDistribution(supabase: Client, subject: "english" | "math"): Promise<LevelDistributionPoint[]> {
    const column = subject === "english" ? "english_level" : "math_level";
    const { data, error } = await supabase.from("students").select(column).eq("is_active", true);
    if (error) throw error;

    const order = ["beginner", "developing", "proficient", "advanced"];
    const counts = new Map(order.map((l) => [l, 0]));
    for (const row of data ?? []) {
      // `column` is one of the two literal level columns, so this narrows
      // the loosely-typed dynamic-column select back to a known field
      // instead of casting to an index-signature type (which would be
      // `string | undefined` under `noUncheckedIndexedAccess`).
      const level = (row as Pick<Student, "english_level" | "math_level">)[column];
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    return order.map((level) => ({ level, count: counts.get(level) ?? 0 }));
  },

  async weakTopics(supabase: Client, limit = 6): Promise<WeakTopicPoint[]> {
    const { data, error } = await supabase
      .from("progress")
      .select("english_topic, english_status, math_topic, math_status")
      .in("english_status", ["needs_help", "not_understood"]);
    if (error) throw error;

    const { data: mathData } = await supabase
      .from("progress")
      .select("math_topic, math_status")
      .in("math_status", ["needs_help", "not_understood"]);

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      if (row.english_topic) counts.set(row.english_topic, (counts.get(row.english_topic) ?? 0) + 1);
    }
    for (const row of mathData ?? []) {
      if (row.math_topic) counts.set(row.math_topic, (counts.get(row.math_topic) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  async volunteerActivity(supabase: Client): Promise<VolunteerActivityPoint[]> {
    const [{ data: volunteers }, { data: progressRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from("volunteers").select("id, name").eq("role", "volunteer").eq("is_active", true),
      supabase.from("progress").select("volunteer_id"),
      supabase.from("assignments").select("volunteer_id"),
    ]);

    return (volunteers ?? []).map((v) => ({
      name: v.name,
      updates: (progressRows ?? []).filter((p) => p.volunteer_id === v.id).length,
      studentsAssigned: (assignmentRows ?? []).filter((a) => a.volunteer_id === v.id).length,
    }));
  },

  /** Volunteers who haven't logged an update for any assigned student in `days`. */
  async pendingVolunteers(supabase: Client, days = 14) {
    const [{ data: volunteers }, { data: assignments }, { data: progressRows }] = await Promise.all([
      supabase.from("volunteers").select("id, name").eq("role", "volunteer").eq("is_active", true),
      supabase.from("assignments").select("volunteer_id, student_id"),
      supabase.from("progress").select("volunteer_id, created_at"),
    ]);

    const lastUpdateByVolunteer = new Map<string, string>();
    for (const row of progressRows ?? []) {
      const existing = lastUpdateByVolunteer.get(row.volunteer_id);
      if (!existing || new Date(row.created_at) > new Date(existing)) {
        lastUpdateByVolunteer.set(row.volunteer_id, row.created_at);
      }
    }

    const assignedVolunteerIds = new Set((assignments ?? []).map((a) => a.volunteer_id));

    return (volunteers ?? [])
      .filter((v) => assignedVolunteerIds.has(v.id))
      .map((v) => {
        const last = lastUpdateByVolunteer.get(v.id);
        const daysSince = last ? differenceInCalendarDays(new Date(), new Date(last)) : Infinity;
        return { id: v.id, name: v.name, daysSinceUpdate: daysSince };
      })
      .filter((v) => v.daysSinceUpdate >= days);
  },
};
