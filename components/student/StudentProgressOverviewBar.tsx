"use client";

import { NotebookText } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubjectProgress {
  /** Topics completed (strictly before the current position) out of the roadmap's total for this grade/subject. */
  completed: number;
  total: number;
}

/**
 * Compact "how far through the roadmap is this student" bar, shown at the
 * top of the profile for both volunteers and admins. Clicking it jumps to
 * the Timeline tab, where every entry — what was taught, by whom, and
 * whether it's been verified — is visible.
 *
 * Completion is intentionally the same currentIndex/total math
 * RoadmapProgressTracker already uses (✔/➡/⬜ list further down this page)
 * so the number here can never disagree with that list — this is a
 * zoomed-out view of the same underlying position, not a second metric.
 *
 * A subject with no roadmap defined for this grade renders as an empty
 * "not set up" segment rather than 0%, so a program that hasn't populated a
 * grade's roadmap yet doesn't read as "this student has made zero
 * progress."
 */
export function StudentProgressOverviewBar({
  english,
  math,
  pendingCount,
  onOpenTimeline,
}: {
  english: SubjectProgress | null;
  math: SubjectProgress | null;
  pendingCount: number;
  onOpenTimeline: () => void;
}) {
  const overallPct = combinedPct(english, math);

  return (
    <button
      type="button"
      onClick={onOpenTimeline}
      className="group flex w-full flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open full progress timeline"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookText className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
          <span className="text-sm font-medium">Roadmap progress</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              {pendingCount} pending
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-muted-foreground underline-offset-2 group-hover:text-primary group-hover:underline">
          View full timeline →
        </span>
      </div>

      <div className="flex items-center gap-3">
        <SegmentBar label="📘 English" progress={english} />
        <SegmentBar label="🔢 Math" progress={math} />
        {overallPct !== null && (
          <span className="shrink-0 text-sm font-semibold tabular-nums">{overallPct}%</span>
        )}
      </div>
    </button>
  );
}

function SegmentBar({ label, progress }: { label: string; progress: SubjectProgress | null }) {
  const pct = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        {pct !== null && progress && (
          <span className="tabular-nums">
            {progress.completed}/{progress.total}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        {pct !== null ? (
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-all",
              pct === 100 && "bg-success"
            )}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        ) : (
          <div className="h-full w-full rounded-full bg-[repeating-linear-gradient(45deg,hsl(var(--border)),hsl(var(--border))_4px,transparent_4px,transparent_8px)]" />
        )}
      </div>
    </div>
  );
}

function combinedPct(english: SubjectProgress | null, math: SubjectProgress | null): number | null {
  const parts = [english, math].filter((p): p is SubjectProgress => Boolean(p && p.total > 0));
  if (parts.length === 0) return null;
  const sum = parts.reduce((acc, p) => acc + p.completed / p.total, 0);
  return Math.round((sum / parts.length) * 100);
}
