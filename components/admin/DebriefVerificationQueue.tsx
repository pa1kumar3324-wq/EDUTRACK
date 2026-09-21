"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { initials, displayName, formatRelativeDate } from "@/lib/utils";
import type { PendingDebrief } from "@/lib/types/database";

/**
 * The lead admin's queue of class debriefs awaiting verification.
 *
 * Verifying is what RECORDS a debrief: only then does it reach the
 * student's roadmap position, the revision/staleness view, reports, and
 * exports. Rejecting keeps the row for audit but counts it nowhere — so a
 * rejection should carry a note, which is why the reject dialog asks for
 * one and the verify path doesn't.
 */
export function DebriefVerificationQueue({
  initialDebriefs,
  canAct,
}: {
  initialDebriefs: PendingDebrief[];
  /**
   * False when the admin is viewing circles they don't lead. The server
   * rejects those writes anyway (guard_debrief_verification), so the
   * buttons are hidden rather than offered and then failing.
   */
  canAct: boolean;
}) {
  const [debriefs, setDebriefs] = useState(initialDebriefs);
  const [rejectTarget, setRejectTarget] = useState<PendingDebrief | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(debrief: PendingDebrief, action: "verify" | "reject", notes?: string) {
    setBusyId(debrief.id);
    try {
      const res = await fetch(`/api/debriefs/${debrief.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes ?? "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to update this debrief");

      // Drop it from the queue optimistically — it's no longer pending, so
      // it wouldn't come back on a refetch either.
      setDebriefs((prev) => prev.filter((d) => d.id !== debrief.id));

      const studentName = debrief.students?.name ?? "the student";
      if (action === "verify") {
        toast.success("Debrief verified", {
          description: `It's now part of ${studentName}'s record and drives what's taught next.`,
        });
      } else {
        toast.success("Debrief sent back", {
          description: `${studentName}'s record is unchanged. Your note is visible on the timeline.`,
        });
      }
      setRejectTarget(null);
      setRejectNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (debriefs.length === 0) {
    return (
      <EmptyState
        title="Nothing awaiting verification"
        description={
          canAct
            ? "When a volunteer in one of your Learning Circles files a class debrief, it appears here for you to record."
            : "No debriefs are pending across the program right now."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {debriefs.map((debrief) => {
        const author = debrief.volunteers;
        const authorName = author ? displayName(author) : "Unknown volunteer";
        const busy = busyId === debrief.id;

        return (
          <Card key={debrief.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={author?.avatar_url ?? undefined} alt={authorName} />
                <AvatarFallback className="text-[10px]">{initials(authorName)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{authorName}</span>
              <span className="text-sm text-muted-foreground">on</span>
              {debrief.students ? (
                <Link
                  href={`/students/${debrief.students.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {debrief.students.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-sm font-medium">Unknown student</span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(debrief.created_at)}
              </span>
              {debrief.learning_circles && (
                <Badge variant="secondary">
                  <Users className="h-3 w-3" />
                  {debrief.learning_circles.name}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(debrief.english_topic || debrief.english_status) && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    English
                  </p>
                  <p className="mt-1 text-sm font-medium">{debrief.english_topic || "—"}</p>
                  <StatusBadge status={debrief.english_status} className="mt-2" />
                </div>
              )}
              {(debrief.math_topic || debrief.math_status) && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Math
                  </p>
                  <p className="mt-1 text-sm font-medium">{debrief.math_topic || "—"}</p>
                  <StatusBadge status={debrief.math_status} className="mt-2" />
                </div>
              )}
            </div>

            {debrief.homework && (
              <p className="text-sm">
                <span className="font-medium">Homework: </span>
                <span className="text-muted-foreground">{debrief.homework}</span>
              </p>
            )}
            {debrief.notes && (
              <p className="text-sm">
                <span className="font-medium">Notes: </span>
                <span className="text-muted-foreground">{debrief.notes}</span>
              </p>
            )}

            {canAct && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" disabled={busy} onClick={() => act(debrief, "verify")}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Verify &amp; record
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRejectTarget(debrief);
                    setRejectNote("");
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Send back
                </Button>
              </div>
            )}
          </Card>
        );
      })}

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this debrief back?</DialogTitle>
            <DialogDescription>
              It won&apos;t be recorded, and {rejectTarget?.students?.name ?? "the student"}&apos;s
              roadmap and levels stay as they are. Say what needs fixing. Your note shows on the
              timeline for the volunteer who filed it.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="reject-note">Note</Label>
            <Textarea
              id="reject-note"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. The math topic doesn't match what was covered. Please re-file with the correct one."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(busyId)}
              onClick={() => rejectTarget && act(rejectTarget, "reject", rejectNote)}
            >
              {busyId && <Loader2 className="h-4 w-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
