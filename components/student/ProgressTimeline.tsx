import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { EditProgressDialog } from "@/components/admin/EditProgressDialog";
import { initials, formatRelativeDate, displayName } from "@/lib/utils";
import type { LearningRoadmapEntry, Progress } from "@/lib/types/database";

type HistoryRow = Progress & {
  volunteers: { name: string; preferred_name: string | null } | null;
  /** Lead admin who verified/rejected, when one did. Joined as `verifier:` to disambiguate from the author. */
  verifier?: { name: string; preferred_name: string | null } | null;
  /** Admin who last corrected this entry's content, when one did. Joined as `editor:`. */
  editor?: { name: string; preferred_name: string | null } | null;
  learning_circles?: { id: string; name: string } | null;
};

/**
 * Vertical timeline of every progress entry, newest first.
 *
 * `isAdmin` + `roadmap` are optional and only needed to show the per-entry
 * "Edit" affordance — pages that render read-only history (e.g. a
 * volunteer's own view) can omit both and get exactly the prior behavior.
 */
export function ProgressTimeline({
  history,
  isAdmin = false,
  roadmap = [],
}: {
  history: HistoryRow[];
  isAdmin?: boolean;
  roadmap?: LearningRoadmapEntry[];
}) {
  return (
    <ol className="relative flex flex-col gap-6 border-l border-border pl-6">
      {history.map((entry) => {
        const volunteerName = entry.volunteers ? displayName(entry.volunteers) : "Unknown volunteer";
          // Anything not yet verified (or sent back) is visible — the
          // volunteer who filed it needs to see it exists — but dimmed, so
          // it never reads as part of the settled record at a glance.
          const isRecorded = entry.verification_status !== "pending" && entry.verification_status !== "rejected";
          return (
          <li key={entry.id} className={isRecorded ? "relative" : "relative opacity-70"}>
            <span
              className={
                isRecorded
                  ? "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary"
                  : "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50 bg-background"
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{initials(volunteerName)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{volunteerName}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeDate(entry.created_at)}</span>
              <VerificationBadge
                status={entry.verification_status}
                inCircle={Boolean(entry.learning_circle_id)}
              />
              {isAdmin && (
                <span className="ml-auto">
                  <EditProgressDialog entry={entry} roadmap={roadmap} />
                </span>
              )}
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
                {/* When both subjects were recorded, suggested_next_lesson is the
                    "Math: ...\n\nEnglish: ..." combined string (see
                    app/api/progress/route.ts) — whitespace-pre-line keeps that
                    readable instead of collapsing the blank line. */}
                <span className="whitespace-pre-line text-foreground">{entry.suggested_next_lesson}</span>
              </div>
            )}

            {entry.verification_notes && (
              <p className="mt-2 text-sm">
                <span className="font-medium">
                  {entry.verification_status === "rejected" ? "Sent back: " : "Reviewer note: "}
                </span>
                <span className="text-muted-foreground">{entry.verification_notes}</span>
              </p>
            )}
            {entry.verification_status === "verified" && entry.verifier && (
              <p className="mt-1 text-xs text-muted-foreground">
                Verified by {displayName(entry.verifier)}
              </p>
            )}
            {entry.edited_by && entry.editor && (
              <p className="mt-1 text-xs text-muted-foreground">
                Edited by {displayName(entry.editor)}
                {entry.edited_at ? ` · ${formatRelativeDate(entry.edited_at)}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
