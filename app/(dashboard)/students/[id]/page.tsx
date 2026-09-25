import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, NotebookPen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { studentRoadmapPositionRepository } from "@/lib/repositories/studentRoadmapPositionRepository";
import { effortRepository } from "@/lib/repositories/effortRepository";
import { resolveRoadmapPosition } from "@/lib/utils/roadmapEngine";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { StudentProfileTabs } from "@/components/student/StudentProfileTabs";
import { RoadmapPositionControl } from "@/components/student/RoadmapPositionControl";
import { TsareenaFocusRegistrar } from "@/components/ai/TsareenaFocusRegistrar";
import { buildRecentSessionSummaries, resolveSubjectExistingSuggestion } from "@/components/ai/TsareenaContext";
import { initials } from "@/lib/utils";
import type { Student, Progress } from "@/lib/types/database";

type HistoryRow = Progress & {
  volunteers: { name: string; preferred_name: string | null } | null;
};

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  let student: Student;

  try {
    student = await studentRepository.getById(supabase, id);
  } catch {
    notFound();
  }

  const [history, assignedVolunteers, roadmap, baselinePositions, effortSummary] = await Promise.all([
    progressRepository.listForStudent(supabase, id),
    studentRepository.assignedVolunteers(supabase, id),
    roadmapRepository.listByGrade(supabase, student.grade),
    studentRoadmapPositionRepository.listForStudent(supabase, id),
    effortRepository.forStudent(supabase, id),
  ]);

  const typedHistory: HistoryRow[] = history;

  // The timeline shows EVERYTHING (including debriefs awaiting their
  // Learning Circle lead, dimmed — the volunteer who filed one needs to see
  // it exists). Everything that reasons about the student's actual state —
  // roadmap position, weak areas, the journey chart — reads only the
  // VERIFIED subset, because an unverified debrief is not yet a recorded
  // fact about this student and must not steer what gets taught next.
  //
  // For a program with no Learning Circles this is the same array: every
  // debrief verifies on insert (and migration 008 backfilled all history).
  const recordedHistory: HistoryRow[] = typedHistory.filter(
    (p) => p.verification_status === "verified"
  );
  const pendingCount = typedHistory.filter((p) => p.verification_status === "pending").length;

  const baselineEnglish = baselinePositions.find((p) => p.subject === "english")?.learning_roadmap ?? null;
  const baselineMath = baselinePositions.find((p) => p.subject === "math")?.learning_roadmap ?? null;

  const englishPosition = resolveRoadmapPosition(
    "english",
    student.grade,
    roadmap,
    recordedHistory,
    baselineEnglish
  );

  const mathPosition = resolveRoadmapPosition(
    "math",
    student.grade,
    roadmap,
    recordedHistory,
    baselineMath
  );

  const canUpdate =
  user.role === "admin" ||
  assignedVolunteers.some(
    (v: { id: string }) => v.id === user.id
  );

  const canManageRoadmapPosition = user.role === "admin";

  const weakTopicCounts = new Map<string, number>();

  for (const p of recordedHistory) {
    if (
      p.english_status === "not_understood" ||
      p.english_status === "needs_help"
    ) {
      if (p.english_topic) {
        weakTopicCounts.set(
          p.english_topic,
          (weakTopicCounts.get(p.english_topic) ?? 0) + 1
        );
      }
    }

    if (
      p.math_status === "not_understood" ||
      p.math_status === "needs_help"
    ) {
      if (p.math_topic) {
        weakTopicCounts.set(
          p.math_topic,
          (weakTopicCounts.get(p.math_topic) ?? 0) + 1
        );
      }
    }
  }

  const weakAreas = Array.from(weakTopicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const homeworkHistory = recordedHistory.filter(
    (p) => p.homework
  );

  // Page-aware context for Tsareena (§21 of the Tsareena spec): built from
  // data this page already fetched via RLS-protected queries. May include
  // the student's name (the UI already legitimately knows it) — the
  // student name never crosses into a Gemini request; see
  // components/ai/TsareenaContext.ts for the sanitizer that enforces this.
  const latestRow = recordedHistory[0];
  const tsareenaFocusContext = {
    studentName: student.name,
    studentId: student.id,
    grade: student.grade,
    englishTopic: englishPosition?.topic ?? null,
    englishStatus: latestRow?.english_status ?? null,
    mathTopic: mathPosition?.topic ?? null,
    mathStatus: latestRow?.math_status ?? null,
    englishRoadmapPosition: englishPosition?.reason ?? null,
    englishNextTopic: englishPosition?.topic ?? null,
    englishRevisionState: englishPosition?.isRevision ? "revision" : "advancement",
    mathRoadmapPosition: mathPosition?.reason ?? null,
    mathNextTopic: mathPosition?.topic ?? null,
    mathRevisionState: mathPosition?.isRevision ? "revision" : "advancement",
    relevantNotes: latestRow?.notes ?? null,
    existingHeuristicSuggestion: latestRow?.suggested_next_lesson ?? null,
    // Per-subject slice of the most recent suggestion that actually covered
    // that subject (§8 of the Tsareena spec) — see
    // resolveSubjectExistingSuggestion for why this can't just be
    // `latestRow.suggested_next_lesson`.
    mathExistingSuggestion: resolveSubjectExistingSuggestion(recordedHistory, "math"),
    englishExistingSuggestion: resolveSubjectExistingSuggestion(recordedHistory, "english"),
    recentSessions: buildRecentSessionSummaries(recordedHistory, 6),
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <TsareenaFocusRegistrar context={tsareenaFocusContext} />
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
      >
        <Link
          href={
            user.role === "admin"
              ? "/admin/people/students"
              : "/dashboard"
          }
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
      </Button>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            <AvatarImage
              src={student.photo_url ?? undefined}
              alt={student.name}
            />
            <AvatarFallback className="text-lg">
              {initials(student.name)}
            </AvatarFallback>
          </Avatar>

          <div>
            <h1 className="font-display text-2xl font-semibold">
              {student.name}
            </h1>

            <p className="text-sm text-muted-foreground">
              Grade {student.grade}
            </p>

            <div className="mt-2 flex flex-wrap gap-3">
              <LevelBadge
                level={student.english_level}
                subject="English"
              />
              <LevelBadge
                level={student.math_level}
                subject="Math"
              />
            </div>
          </div>
        </div>

        {canUpdate && (
          <Button asChild>
            <Link href={`/students/${id}/update`}>
              <NotebookPen className="h-4 w-4" />
              Update Progress
            </Link>
          </Button>
        )}
      </div>

      {canManageRoadmapPosition && (
        <RoadmapPositionControl
          studentId={id}
          grade={student.grade}
          roadmap={roadmap}
          currentBaseline={{
            english: baselineEnglish?.id ?? null,
            math: baselineMath?.id ?? null,
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              English {englishPosition?.source === "baseline" ? "starting point" : "recommended next"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {englishPosition ? (
              <>
                <p className="font-medium">
                  {englishPosition.topic}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {englishPosition.reason}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {englishPosition.isRevision && (
                    <Badge variant="warning">
                      Needs revision
                    </Badge>
                  )}
                  <Badge variant={englishPosition.source === "baseline" ? "default" : "outline"}>
                    {englishPosition.source === "baseline" ? "Leader-set starting point" : "Automatically recommended"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No roadmap defined for grade {student.grade} English
                yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Math {mathPosition?.source === "baseline" ? "starting point" : "recommended next"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {mathPosition ? (
              <>
                <p className="font-medium">
                  {mathPosition.topic}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {mathPosition.reason}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {mathPosition.isRevision && (
                    <Badge variant="warning">
                      Needs revision
                    </Badge>
                  )}
                  <Badge variant={mathPosition.source === "baseline" ? "default" : "outline"}>
                    {mathPosition.source === "baseline" ? "Leader-set starting point" : "Automatically recommended"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No roadmap defined for grade {student.grade} Math
                yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary to the academic English/Math cards above — effort is a
          separate, non-academic signal (participation, persistence,
          willingness to try), so it's a small strip, not another full
          card in that grid. See supabase/migrations/011_effort_score.sql. */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">⭐ Effort</span>
        {effortSummary ? (
          <span className="text-sm">
            <span className="font-semibold tabular-nums">{effortSummary.average_effort_score.toFixed(1)} / 10</span>{" "}
            <span className="text-muted-foreground">
              · {effortSummary.effort_score_count} rated session{effortSummary.effort_score_count === 1 ? "" : "s"}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No effort scores have been recorded yet.</span>
        )}
      </div>

      <StudentProfileTabs
        student={student}
        englishPosition={englishPosition}
        mathPosition={mathPosition}
        roadmap={roadmap}
        typedHistory={typedHistory}
        recordedHistory={recordedHistory}
        pendingCount={pendingCount}
        weakAreas={weakAreas}
        homeworkHistory={homeworkHistory}
        assignedVolunteers={assignedVolunteers}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}