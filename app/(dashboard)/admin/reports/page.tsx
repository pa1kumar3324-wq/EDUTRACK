import { AlertTriangle, Clock, UserX } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExportPanel } from "@/components/admin/ExportPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminReportsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: revisionRows }, pendingVolunteers] = await Promise.all([
    supabase.from("students_needing_revision").select("*"),
    analyticsRepository.pendingVolunteers(supabase, 14),
  ]);

  const staleStudents = (revisionRows ?? []).filter((r) => r.stale);
  const doubleRedStudents = (revisionRows ?? []).filter((r) => r.english_double_red || r.math_double_red);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports & Notifications" description="Export data and see who needs attention." />

      <ExportPanel />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-warning" /> Not updated in 14+ days</CardTitle>
            <CardDescription>{staleStudents.length} student(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {staleStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone's up to date. 🎉</p>
            ) : (
              staleStudents.map((s) => (
                <div key={s.student_id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  <span>{s.name}</span>
                  <Badge variant="warning">Grade {s.grade}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-destructive" /> Marked 🔴 twice in a row</CardTitle>
            <CardDescription>{doubleRedStudents.length} student(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {doubleRedStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repeated struggles flagged.</p>
            ) : (
              doubleRedStudents.map((s) => (
                <div key={s.student_id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  <span>{s.name}</span>
                  <Badge variant="destructive">Grade {s.grade}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><UserX className="h-4 w-4 text-muted-foreground" /> Volunteers with pending updates</CardTitle>
            <CardDescription>{pendingVolunteers.length} volunteer(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingVolunteers.length === 0 ? (
              <p className="text-sm text-muted-foreground">All volunteers are current.</p>
            ) : (
              pendingVolunteers.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  <span>{v.name}</span>
                  <Badge variant="outline">
                    {v.daysSinceUpdate === Infinity ? "No updates yet" : `${v.daysSinceUpdate}d ago`}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
