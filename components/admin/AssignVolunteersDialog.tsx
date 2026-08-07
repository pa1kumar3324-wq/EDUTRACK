"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { initials } from "@/lib/utils";
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

    try {
      await Promise.all([
        ...toAdd.map((volunteerId) =>
          fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: student.id, volunteerId }),
          })
        ),
        ...toRemove.map((volunteerId) =>
          fetch("/api/assignments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: student.id, volunteerId }),
          })
        ),
      ]);
      toast.success("Assignments updated");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Failed to update assignments");
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
                  <AvatarImage src={v.avatar_url ?? undefined} alt={v.name} />
                  <AvatarFallback className="text-[10px]">{initials(v.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.name}</p>
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
