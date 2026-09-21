"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { initials, displayName } from "@/lib/utils";
import type { Student, Volunteer } from "@/lib/types/database";

interface AssignVolunteersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  allVolunteers: Volunteer[];
  currentlyAssignedIds: string[];
  onSaved: () => void;
}

/** Lets an admin toggle which volunteers are assigned to a given student. */
export function AssignVolunteersDialog({
  open,
  onOpenChange,
  student,
  allVolunteers,
  currentlyAssignedIds,
  onSaved,
}: AssignVolunteersDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set(currentlyAssignedIds));
  }, [open, currentlyAssignedIds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!student) return;
    setIsSaving(true);
    const toAdd = [...selected].filter((id) => !currentlyAssignedIds.includes(id));
    const toRemove = currentlyAssignedIds.filter((id) => !selected.has(id));

    // `fetch()` only rejects on network-level failure — it resolves
    // normally with a non-ok Response for HTTP 4xx/5xx. Promise.all would
    // therefore report success even when a change failed server-side, so
    // each request is checked individually with allSettled and any
    // non-ok/rejected result is surfaced by volunteer name instead of an
    // all-or-nothing toast.
    const volunteerNameById = new Map(allVolunteers.map((v) => [v.id, displayName(v)]));
    const jobs = [
      ...toAdd.map((volunteerId) => ({ volunteerId, method: "POST" as const })),
      ...toRemove.map((volunteerId) => ({ volunteerId, method: "DELETE" as const })),
    ];

    try {
      const results = await Promise.allSettled(
        jobs.map(async (job) => {
          const res = await fetch("/api/assignments", {
            method: job.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: student.id, volunteerId: job.volunteerId }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Request failed");
          }
        })
      );

      const failures = results
        // Non-null: `results` comes from `Promise.allSettled(jobs.map(...))`,
        // which always preserves the input array's length and order.
        .map((result, i) => ({ result, job: jobs[i]! }))
        .filter(({ result }) => result.status === "rejected");

      if (failures.length === 0) {
        toast.success("Assignments updated");
        onOpenChange(false);
      } else {
        const names = failures
          .map(({ job }) => volunteerNameById.get(job.volunteerId) ?? "a volunteer")
          .join(", ");
        toast.error(`Failed to update: ${names}`, {
          description: "Other changes were saved. Reopen this dialog to retry the failed ones.",
        });
      }
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign volunteers</DialogTitle>
          <DialogDescription>{student ? `Choose who teaches ${student.name}.` : ""}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {allVolunteers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No volunteers yet.</p>
          ) : (
            allVolunteers.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary"
              >
                <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggle(v.id)} />
                <Avatar className="h-7 w-7">
                  <AvatarImage src={v.avatar_url ?? undefined} alt={displayName(v)} />
                  <AvatarFallback className="text-[10px]">{initials(displayName(v))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName(v)}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.email}</p>
                </div>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
