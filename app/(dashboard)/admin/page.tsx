import { Users, UserCog, CalendarCheck, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  WeeklyProgressChart,
  LevelDistributionChart,
  WeakTopicsChart,
  VolunteerActivityChart,
} from "@/components/admin/AnalyticsCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import type { RecentActivityItem } from "@/lib/types";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [stats, weeklyProgress, englishLevels, mathLevels, weakTopics, volunteerActivity, recentRows] =
    await Promise.all([
      analyticsRepository.adminStats(supabase),
      analyticsRepository.weeklyProgress(supabase),
      analyticsRepository.levelDistribution(supabase, "english"),
      analyticsRepository.levelDistribution(supabase, "math"),
      analyticsRepository.weakTopics(supabase),
      analyticsRepository.volunteerActivity(supabase),
      progressRepository.recent(supabase, 8),
    ]);

 type RecentRow = {
  id: string;
  student_id: string;
  created_at: string;
  english_topic: string | null;
  math_topic: string | null;
  students: { name: string } | null;
  volunteers: { name: string } | null;
};

const recentActivity: RecentActivityItem[] = recentRows.map((r: RecentRow) => {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.students?.name ?? "Unknown",
    volunteerName: r.volunteers?.name ?? "Unknown",
    createdAt: r.created_at,
    summary: r.english_topic || r.math_topic || "session logged",
  };
});

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin Overview" description="Program-wide analytics, at a glance." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Students" value={stats.totalStudents} icon={Users} />
        <StatCard label="Total Volunteers" value={stats.totalVolunteers} icon={UserCog} />
        <StatCard label="Updated Today" value={stats.studentsUpdatedToday} icon={CalendarCheck} tone="success" />
        <StatCard label="Needing Revision" value={stats.studentsNeedingRevision} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyProgressChart data={weeklyProgress} />
        <VolunteerActivityChart data={volunteerActivity} />
        <LevelDistributionChart title="English Levels" data={englishLevels} />
        <LevelDistributionChart title="Math Levels" data={mathLevels} />
      </div>

      <WeakTopicsChart data={weakTopics} />

      <RecentActivity items={recentActivity} />
    </div>
  );
}
