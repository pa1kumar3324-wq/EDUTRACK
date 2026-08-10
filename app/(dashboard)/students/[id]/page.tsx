import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, NotebookPen, NotebookText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { studentRoadmapPositionRepository } from "@/lib/repositories/studentRoadmapPositionRepository";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LevelBadge } from "@/components/shared/LevelBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProgressTimeline } from "@/components/student/ProgressTimeline";
import { RoadmapProgressTracker } from "@/components/student/RoadmapProgressTracker";
import { RoadmapPositionControl } from "@/components/student/RoadmapPositionControl";
import { StudentJourneyChart } from "@/components/charts/StudentJourneyChart";
import { initials, formatRelativeDate } from "@/lib/utils";
import type { Student, Progress } from "@/lib/types/database";

type HistoryRow = Progress & {
  volunteers: { name: string } | null;
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

  const [history, assignedVolunteers, roadmap, baselinePositions] = await Promise.all([
    progressRepository.listForStudent(supabase, id),
    studentRepository.assignedVolunteers(supabase, id),
    roadmapRepository.listByGrade(supabase, student.grade),
    studentRoadmapPositionRepository.listForStudent(supabase, id),
  ]);

  const typedHistory: HistoryRow[] = history;

  const baselineEnglish = baselinePositions.find((p) => p.subject === "english")?.learning_roadmap ?? null;
  const baselineMath = baselinePositions.find((p) => p.subject === "math")?.learning_roadmap ?? null;

  const englishPosition = resolveRoadmapPosition(
    "english",
    student.grade,
    roadmap,
    typedHistory,
    baselineEnglish
  );

  const mathPosition = resolveRoadmapPosition(
    "math",
    student.grade,
    roadmap,
    typedHistory,
    baselineMath
  );

  const canUpdate =
  user.role === "admin" ||
  assignedVolunteers.some(
    (v: { id: string }) => v.id === user.id
  );

  const canManageRoadmapPosition = user.role === "admin";

  const weakTopicCounts = new Map<string, number>();

  for (const p of typedHistory) {
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

  const homeworkHistory = typedHistory.filter(
    (p) => p.homework
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
      >
        <Link
          href={
            user.role === "admin"
              ? "/admin/students"
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
              📘 {englishPosition?.source === "baseline" ? "Starting Point" : "Recommended Next"} — English
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
              🔢 {mathPosition?.source === "baseline" ? "Starting Point" : "Recommended Next"} — Math
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

      <Tabs defaultValue="roadmap">
        <TabsList>
          <TabsTrigger value="roadmap">
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="journey">
            English &amp; Math Journey
          </TabsTrigger>
          <TabsTrigger value="weak-areas">
            Weak Areas
          </TabsTrigger>
          <TabsTrigger value="homework">
            Homework History
          </TabsTrigger>
          <TabsTrigger value="volunteers">
            Volunteers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  📘 English Roadmap
                </CardTitle>
              </CardHeader>

              <CardContent>
                <RoadmapProgressTracker subject="english" roadmap={roadmap} position={englishPosition} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  🔢 Math Roadmap
                </CardTitle>
              </CardHeader>

              <CardContent>
                <RoadmapProgressTracker subject="math" roadmap={roadmap} position={mathPosition} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {typedHistory.length === 0 ? (
            <EmptyState
              icon={NotebookText}
              title="No sessions logged yet"
              description="Once a volunteer submits an update, the full history appears here."
            />
          ) : (
            <ProgressTimeline history={typedHistory} />
          )}
        </TabsContent>

        <TabsContent value="journey" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  📘 English Journey
                </CardTitle>
              </CardHeader>

              <CardContent>
                <StudentJourneyChart
                  history={typedHistory}
                  subject="english"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  🔢 Math Journey
                </CardTitle>
              </CardHeader>

              <CardContent>
                <StudentJourneyChart
                  history={typedHistory}
                  subject="math"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="weak-areas" className="mt-4">
          {weakAreas.length === 0 ? (
            <EmptyState
              icon={NotebookText}
              title="No weak areas flagged"
              description="Topics marked 'Needs Help' or 'Didn't Understand' will show up here."
            />
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {weakAreas.map(([topic, count]) => (
                  <div
                    key={topic}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="text-sm font-medium">
                      {topic}
                    </span>

                    <Badge variant="warning">
                      {count}x flagged
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="homework" className="mt-4">
          {homeworkHistory.length === 0 ? (
            <EmptyState
              icon={NotebookText}
              title="No homework logged"
              description="Homework assigned during sessions will appear here."
            />
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {homeworkHistory.map((p) => (
                  <div key={p.id} className="px-5 py-3">
                    <p className="text-sm">{p.homework}</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.volunteers?.name ?? "Unknown"} ·{" "}
                      {formatRelativeDate(p.created_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="volunteers" className="mt-4">
  {assignedVolunteers.length === 0 ? (
    <EmptyState
      icon={NotebookText}
      title="No volunteers assigned"
      description="An admin can assign volunteers from the admin panel."
    />
  ) : (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {assignedVolunteers.map(
        (v: {
          id: string;
          name: string;
          email: string;
          avatar_url: string | null;
        }) => (
          <Card key={v.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={v.avatar_url ?? undefined}
                  alt={v.name}
                />
                <AvatarFallback>
                  {initials(v.name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <p className="text-sm font-medium">
                  {v.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  {v.email}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  )}
</TabsContent>
      </Tabs>
    </div>
  );
}