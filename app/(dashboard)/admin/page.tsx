import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { StatStrip } from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  WeeklyProgressChart,
  LevelDistributionChart,
  WeakTopicsChart,
} from "@/components/admin/AnalyticsCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { displayName } from "@/lib/utils";
import type { RecentActivityItem } from "@/lib/types";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [stats, weeklyProgress, englishLevels, mathLevels, weakTopics, recentRows] =
    await Promise.all([
      analyticsRepository.adminStats(supabase),
      analyticsRepository.weeklyProgress(supabase),
      analyticsRepository.levelDistribution(supabase, "english"),
      analyticsRepository.levelDistribution(supabase, "math"),
      analyticsRepository.weakTopics(supabase),
      progressRepository.recent(supabase, 8),
    ]);

 type RecentRow = {
  id: string;
  student_id: string;
  created_at: string;
  english_topic: string | null;
  math_topic: string | null;
  students: { name: string } | null;
  volunteers: { name: string; preferred_name: string | null } | null;
};

const recentActivity: RecentActivityItem[] = recentRows.map((r: RecentRow) => {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.students?.name ?? "Unknown",
    volunteerName: r.volunteers ? displayName(r.volunteers) : "Unknown",
    createdAt: r.created_at,
    summary: r.english_topic || r.math_topic || "session logged",
  };
});

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" />

      <StatStrip
        stats={[
          { label: "Total students", value: stats.totalStudents },
          { label: "Total volunteers", value: stats.totalVolunteers },
          { label: "Updated today", value: stats.studentsUpdatedToday, tone: "success" },
          { label: "Needing revision", value: stats.studentsNeedingRevision, tone: "destructive" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <WeeklyProgressChart data={weeklyProgress} />
        <LevelDistributionChart title="English Levels" data={englishLevels} />
        <LevelDistributionChart title="Math Levels" data={mathLevels} />
      </div>

      <WeakTopicsChart data={weakTopics} />

      <RecentActivity items={recentActivity} />
    </div>
  );
}
