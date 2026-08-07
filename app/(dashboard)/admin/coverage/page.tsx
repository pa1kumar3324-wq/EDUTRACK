import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { CoverageBoard } from "@/components/admin/CoverageBoard";
import { cn } from "@/lib/utils";

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireAdmin();
  const { week } = await searchParams;
  const weekOffset = Math.max(0, Number(week) || 0);

  const supabase = await createClient();
  const coverage = await analyticsRepository.weekendCoverage(supabase, weekOffset);

  const coverageTone =
    coverage.coveragePercent >= 80 ? "text-success" : coverage.coveragePercent >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coverage"
        description={'Which students were updated this weekend — the one question this page answers.'}
      />

      <Card>
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {coverage.weekendLabel}
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/coverage?week=${weekOffset + 1}`}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous weekend
                </Link>
              </Button>
              {weekOffset === 0 ? (
                <Button variant="outline" size="sm" disabled>
                  Next weekend <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/coverage?week=${weekOffset - 1}`}>
                    Next weekend <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <p className={cn("font-display text-3xl font-semibold tabular-nums", coverageTone)}>
                {coverage.coveragePercent}%
              </p>
              <p className="text-xs text-muted-foreground">Coverage</p>
              <Progress value={coverage.coveragePercent} className="mt-2" />
            </div>
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums text-success">{coverage.updatedCount}</p>
              <p className="text-xs text-muted-foreground">Updated students</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums text-destructive">{coverage.missingCount}</p>
              <p className="text-xs text-muted-foreground">Missing students</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {coverage.entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Once students are added, weekend coverage will show up here."
        />
      ) : (
        <CoverageBoard entries={coverage.entries} />
      )}
    </div>
  );
}
