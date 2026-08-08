import {
  Users,
  Users as UsersIcon,
  CalendarCheck,
  ListTodo,
  AlertTriangle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { attendanceRepository } from "@/lib/repositories/attendanceRepository";
import { StatCard } from "@/components/dashboard/StatCard";
import { StudentCard } from "@/components/dashboard/StudentCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AttendancePieChart } from "@/components/dashboard/AttendancePieChart";
import { EmptyState } from "@/components/shared/EmptyState";
import type {
  StudentWithProgress,
  RecentActivityItem,
  LatestProgress,
} from "@/lib/types";
import type { Student } from "@/lib/types/database";

type RevisionRow = {
  student_id: string;
};

export default async function VolunteerDashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [
    students,
    stats,
    revisionRows,
    allLatestProgress,
    attendanceSummary,
  ] = await Promise.all([
    studentRepository.list(supabase, { volunteerId: user.id }),
    analyticsRepository.dashboardStats(supabase, user.id),
    progressRepository.needingRevision(supabase),
    progressRepository.latestForAllStudents(supabase),
    attendanceRepository.summaryForVolunteer(supabase, user.id),
  ]);

  const typedStudents = (students ?? []) as Student[];

  const typedRevisionRows =
    (revisionRows ?? []) as RevisionRow[];

  const typedLatestProgress =
    (allLatestProgress ?? []) as LatestProgress[];

  const revisionIds = new Set(
    typedRevisionRows.map((r) => r.student_id)
  );

  const latestByStudent = new Map(
    typedLatestProgress.map((p) => [p.student_id, p])
  );

  const studentsWithProgress: StudentWithProgress[] =
    await Promise.all(
      typedStudents.map(async (student: Student) => {
        const assignedVolunteers =
          await studentRepository.assignedVolunteers(
            supabase,
            student.id
          );

        const latestProgress =
          latestByStudent.get(student.id) ?? null;

        let status: StudentWithProgress["status"] = "on-track";

        if (revisionIds.has(student.id)) {
          status = "needs-revision";
        } else if (!latestProgress) {
          status = "stale";
        }

        return {
          student,
          latestProgress,
          assignedVolunteers,
          status,
        };
      })
    );

  const recentActivity: RecentActivityItem[] =
    studentsWithProgress
      .filter((s) => s.latestProgress)
      .sort(
        (a, b) =>
          new Date(b.latestProgress!.created_at).getTime() -
          new Date(a.latestProgress!.created_at).getTime()
      )
      .slice(0, 6)
      .map((s) => ({
        id: s.latestProgress!.id,
        studentId: s.student.id,
        studentName: s.student.name,
        volunteerName:
          s.latestProgress!.volunteer_name ?? "Unknown",
        createdAt: s.latestProgress!.created_at,
        summary:
          s.latestProgress!.english_topic ||
          s.latestProgress!.math_topic ||
          "session logged",
      }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold">
          Welcome back, {user.name.split(" ")[0]}
        </h1>

        <p className="text-sm text-muted-foreground">
          Here's exactly where each of your students left off.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Students Assigned"
          value={stats.studentsAssigned}
          icon={Users}
        />

        <StatCard
          label="Updated This Week"
          value={stats.studentsUpdatedThisWeek}
          icon={CalendarCheck}
          tone="success"
        />

        <StatCard
          label="Pending Updates"
          value={stats.pendingUpdates}
          icon={ListTodo}
          tone="warning"
        />

        <StatCard
          label="Needing Revision"
          value={stats.studentsNeedingRevision}
          icon={AlertTriangle}
          tone="destructive"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
            Your Students
          </h2>

          {studentsWithProgress.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No students assigned yet"
              description="Once an admin assigns students to you, they'll appear here as cards — no searching required."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {studentsWithProgress.map((s, i) => (
                <StudentCard
                  key={s.student.id}
                  data={s}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>

        <AttendancePieChart summary={attendanceSummary} />
      </div>

      <RecentActivity items={recentActivity} />
    </div>
  );
}