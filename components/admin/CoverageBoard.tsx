"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, X, GraduationCap } from "lucide-react";
import { format, parseISO, addDays, isAfter } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { initials, cn } from "@/lib/utils";
import type { WeekendCoverage } from "@/lib/types";

export function CoverageBoard({ coverage }: { coverage: WeekendCoverage }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const start = parseISO(coverage.weekendStart);
  const end = parseISO(coverage.weekendEnd);
  const label = `${format(start, "MMM d")}\u2013${format(end, "d, yyyy")}`;
  const canGoNext = !isAfter(addDays(start, 7), new Date());

  function navigate(deltaWeeks: -1 | 1) {
    setIsPending(true);
    const next = format(addDays(start, deltaWeeks * 7), "yyyy-MM-dd");
    router.push(`/admin/coverage?weekend=${next}`);
  }

  const ringColor =
    coverage.coveragePct >= 80 ? "text-success" : coverage.coveragePct >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="flex flex-col gap-6">
      <Card className="grain overflow-hidden">
        <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-stretch sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} disabled={isPending} aria-label="Previous weekend">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center sm:text-left">
              <p className="font-display text-lg font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">Weekend session coverage</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigate(1)} disabled={isPending || !canGoNext} aria-label="Next weekend">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-secondary" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className={cn("transition-[stroke-dashoffset] duration-700 ease-out", ringColor)}
                  stroke="currentColor"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - coverage.coveragePct / 100)}
                />
              </svg>
              <span className="absolute font-display text-xl font-bold">
                <AnimatedNumber value={coverage.coveragePct} suffix="%" />
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p>
                <span className="font-display text-xl font-semibold text-success">
                  <AnimatedNumber value={coverage.updatedCount} />
                </span>{" "}
                <span className="text-muted-foreground">updated</span>
              </p>
              <p>
                <span className="font-display text-xl font-semibold text-destructive">
                  <AnimatedNumber value={coverage.missingCount} />
                </span>{" "}
                <span className="text-muted-foreground">missing</span>
              </p>
              <p className="text-xs text-muted-foreground">of {coverage.totalActiveStudents} active students</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StudentList
          title="Missing an update"
          tone="destructive"
          students={coverage.missingStudents}
          emptyLabel="Everyone was covered this weekend 🎉"
        />
        <StudentList title="Updated" tone="success" students={coverage.updatedStudents} emptyLabel="No updates logged yet for this weekend." />
      </div>
    </div>
  );
}

function StudentList({
  title,
  tone,
  students,
  emptyLabel,
}: {
  title: string;
  tone: "success" | "destructive";
  students: WeekendCoverage["missingStudents"];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              tone === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            )}
          >
            {tone === "success" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          </span>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">({students.length})</span>
        </div>
        {students.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-1 scrollbar-thin max-h-80 overflow-y-auto">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/60">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={s.photoUrl ?? undefined} alt={s.name} />
                  <AvatarFallback className="text-xs">{initials(s.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <GraduationCap className="h-3 w-3" /> Grade {s.grade}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
