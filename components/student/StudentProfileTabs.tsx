"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProgressTimeline } from "@/components/student/ProgressTimeline";
import { RoadmapProgressTracker } from "@/components/student/RoadmapProgressTracker";
import { StudentProgressOverviewBar } from "@/components/student/StudentProgressOverviewBar";
import { StudentJourneyChart } from "@/components/charts/StudentJourneyChart";
import { initials, formatRelativeDate, displayName } from "@/lib/utils";
import type { LearningRoadmapEntry, Progress, Student } from "@/lib/types/database";
import type { RoadmapPosition } from "@/lib/utils/roadmapEngine";

type HistoryRow = Progress & {
  volunteers: { name: string; preferred_name: string | null } | null;
  verifier?: { name: string; preferred_name: string | null } | null;
  editor?: { name: string; preferred_name: string | null } | null;
  learning_circles?: { id: string; name: string } | null;
};

type AssignedVolunteer = {
  id: string;
  name: string;
  preferred_name: string | null;
  email: string;
  avatar_url: string | null;
};

/**
 * Everything below the student header: the roadmap-progress bar and the
 * tabbed detail views (Roadmap / Timeline / Journey / Weak Areas /
 * Homework / Volunteers).
 *
 * This is one client component — rather than a server-rendered `<Tabs>`
 * with a separate progress-bar element beside it — specifically so the
 * progress bar can drive which tab is open: Radix's Tabs only exposes
 * controlled state (`value`/`onValueChange`) to components inside the same
 * client boundary, so the bar and the tabs have to share one `useState`
 * here rather than being two independent islands that can't talk to each
 * other.
 */
export function StudentProfileTabs({
  student,
  englishPosition,
  mathPosition,
  roadmap,
  typedHistory,
  recordedHistory,
  pendingCount,
  weakAreas,
  homeworkHistory,
  assignedVolunteers,
  isAdmin,
}: {
  student: Student;
  englishPosition: RoadmapPosition | null;
  mathPosition: RoadmapPosition | null;
  roadmap: LearningRoadmapEntry[];
  typedHistory: HistoryRow[];
  recordedHistory: HistoryRow[];
  pendingCount: number;
  weakAreas: [string, number][];
  homeworkHistory: HistoryRow[];
  assignedVolunteers: AssignedVolunteer[];
  /** Whether to show the per-entry "Edit" affordance on the timeline. */
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState("roadmap");

  return (
    <>
      <StudentProgressOverviewBar
        english={subjectProgress("english", roadmap, englishPosition)}
        math={subjectProgress("math", roadmap, mathPosition)}
        pendingCount={pendingCount}
        onOpenTimeline={() => setTab("timeline")}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="journey">English &amp; Math Journey</TabsTrigger>
          <TabsTrigger value="weak-areas">Weak Areas</TabsTrigger>
          <TabsTrigger value="homework">Homework History</TabsTrigger>
          <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📘 English Roadmap</CardTitle>
              </CardHeader>
              <CardContent>
                <RoadmapProgressTracker subject="english" roadmap={roadmap} position={englishPosition} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">🔢 Math Roadmap</CardTitle>
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
              title="No sessions logged yet"
              description="Once a volunteer submits an update, the full history appears here."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Only ever shown when a Learning Circle is actually in play,
                  so programs that don't use circles see the timeline
                  exactly as before. */}
              {pendingCount > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {pendingCount} debrief{pendingCount === 1 ? "" : "s"} awaiting verification.
                    </span>{" "}
                    Shown below but not yet part of {student.name}&apos;s record. They don&apos;t affect
                    levels, roadmap position, or reports until a Learning Circle lead verifies them.
                  </p>
                </div>
              )}
              <ProgressTimeline history={typedHistory} isAdmin={isAdmin} roadmap={roadmap} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="journey" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📘 English Journey</CardTitle>
              </CardHeader>
              <CardContent>
                <StudentJourneyChart history={recordedHistory} subject="english" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">🔢 Math Journey</CardTitle>
              </CardHeader>
              <CardContent>
                <StudentJourneyChart history={recordedHistory} subject="math" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="weak-areas" className="mt-4">
          {weakAreas.length === 0 ? (
            <EmptyState
              title="No weak areas flagged"
              description="Topics marked 'Needs Help' or 'Didn't Understand' will show up here."
            />
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {weakAreas.map(([topic, count]) => (
                  <div key={topic} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm font-medium">{topic}</span>
                    <Badge variant="warning">{count}x flagged</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="homework" className="mt-4">
          {homeworkHistory.length === 0 ? (
            <EmptyState
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
                      {p.volunteers ? displayName(p.volunteers) : "Unknown"} ·{" "}
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
              title="No volunteers assigned"
              description="An admin can assign volunteers from the admin panel."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {assignedVolunteers.map((v) => (
                <Link
                  key={v.id}
                  href={`/volunteers/${v.id}`}
                  className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Card className="transition-colors hover:bg-secondary/40">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={v.avatar_url ?? undefined} alt={displayName(v)} />
                        <AvatarFallback>{initials(displayName(v))}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{displayName(v)}</p>
                        <p className="text-xs text-muted-foreground">{v.email}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Same ordered-roadmap/currentIndex math RoadmapProgressTracker renders as
 * a ✔/➡/⬜ list — reused here rather than reimplemented, so the number in
 * the bar can never drift from that list. Returns null (not a 0-total
 * object) when the grade has no roadmap for this subject yet, so the bar
 * can distinguish "not set up" from "0% complete".
 */
function subjectProgress(
  subject: "english" | "math",
  roadmap: LearningRoadmapEntry[],
  position: RoadmapPosition | null
): { completed: number; total: number } | null {
  const ordered = roadmap.filter((r) => r.subject === subject).sort((a, b) => a.order_index - b.order_index);
  if (ordered.length === 0) return null;

  const currentIndex = position
    ? ordered.findIndex((r) => r.topic.toLowerCase() === position.topic.toLowerCase())
    : -1;

  return { completed: Math.max(currentIndex, 0), total: ordered.length };
}
