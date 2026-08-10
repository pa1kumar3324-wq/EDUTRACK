import { cn } from "@/lib/utils";
import type { LearningRoadmapEntry, Subject } from "@/lib/types/database";
import type { RoadmapPosition } from "@/lib/utils/roadmapEngine";

interface RoadmapProgressTrackerProps {
  subject: Subject;
  roadmap: LearningRoadmapEntry[];
  position: RoadmapPosition | null;
}

/**
 * Renders the roadmap as a ✔ done / ➡ current / ⬜ upcoming sequence instead of a
 * plain table — the student's current position (resolved via
 * resolveRoadmapPosition, which may be a leader-set starting point or the
 * automatic recommendation) is highlighted, with a badge when it's a
 * leader-set starting point that progress hasn't advanced past yet.
 */
export function RoadmapProgressTracker({ subject, roadmap, position }: RoadmapProgressTrackerProps) {
  const ordered = roadmap.filter((r) => r.subject === subject).sort((a, b) => a.order_index - b.order_index);

  if (ordered.length === 0) {
    return <p className="text-sm text-muted-foreground">No roadmap defined for this grade yet.</p>;
  }

  const currentIndex = position
    ? ordered.findIndex((r) => r.topic.toLowerCase() === position.topic.toLowerCase())
    : -1;

  return (
    <ol className="flex flex-col gap-1">
      {ordered.map((entry, i) => {
        const isDone = currentIndex >= 0 ? i < currentIndex : false;
        const isCurrent = i === currentIndex;
        return (
          <li
            key={entry.id}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm",
              isCurrent && "bg-primary/10 font-medium text-primary"
            )}
          >
            <span aria-hidden className="w-4 shrink-0 text-center">
              {isDone ? "✔" : isCurrent ? "➡" : "⬜"}
            </span>
            <span className={cn(isDone && "text-muted-foreground line-through decoration-muted-foreground/40")}>
              {entry.topic}
            </span>
            {isCurrent && position?.isRevision && (
              <span className="ml-auto shrink-0 text-xs font-normal text-warning">revise</span>
            )}
            {isCurrent && position?.source === "baseline" && (
              <span className="ml-auto shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-primary">
                Leader-set starting point
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
