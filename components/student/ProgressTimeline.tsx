import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { initials, formatRelativeDate } from "@/lib/utils";
import type { Progress } from "@/lib/types/database";

type HistoryRow = Progress & { volunteers: { name: string } | null };

/** Vertical timeline of every progress entry, newest first. */
export function ProgressTimeline({ history }: { history: HistoryRow[] }) {
  return (
    <ol className="relative flex flex-col gap-6 border-l border-border pl-6">
      {history.map((entry) => {
        const volunteerName = entry.volunteers?.name ?? "Unknown volunteer";
        return (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{initials(volunteerName)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{volunteerName}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeDate(entry.created_at)}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(entry.english_topic || entry.english_status) && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">English</p>
                  <p className="mt-1 text-sm font-medium">{entry.english_topic || "—"}</p>
                  <StatusBadge status={entry.english_status} className="mt-2" />
                </div>
              )}
              {(entry.math_topic || entry.math_status) && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Math</p>
                  <p className="mt-1 text-sm font-medium">{entry.math_topic || "—"}</p>
                  <StatusBadge status={entry.math_status} className="mt-2" />
                </div>
              )}
            </div>

            {entry.homework && (
              <p className="mt-3 text-sm">
                <span className="font-medium">Homework: </span>
                <span className="text-muted-foreground">{entry.homework}</span>
              </p>
            )}
            {entry.notes && (
              <p className="mt-1 text-sm">
                <span className="font-medium">Notes: </span>
                <span className="text-muted-foreground">{entry.notes}</span>
              </p>
            )}
            {entry.suggested_next_lesson && (
              <div className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-sm">
                <span className="font-medium text-primary">Suggested next lesson: </span>
                <span className="text-foreground">{entry.suggested_next_lesson}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
