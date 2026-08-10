"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LearningRoadmapEntry, Subject } from "@/lib/types/database";

interface RoadmapPositionControlProps {
  studentId: string;
  grade: number;
  roadmap: LearningRoadmapEntry[];
  /** Currently leader-set starting-point roadmap_id per subject, or null/undefined if automatic. */
  currentBaseline: Partial<Record<Subject, string | null>>;
}

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "english", label: "English" },
  { value: "math", label: "Math" },
];

/**
 * Leader-only control on the student profile: lets an admin set where this
 * student's roadmap should START for a subject — a baseline, not a
 * permanent pin. Once progress is recorded at or beyond that point, the
 * normal automatic recommendation engine takes over and advances the
 * student through the roadmap as usual (see resolveRoadmapPosition).
 * Leaders can also clear the starting point to return fully to automatic
 * tracking based on actual progress. Never modifies progress history —
 * writes only to /api/students/:id/roadmap-position, which is admin-gated
 * server-side.
 */
export function RoadmapPositionControl({ studentId, grade, roadmap, currentBaseline }: RoadmapPositionControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<Subject>("english");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState<Subject | null>(null);

  const topicsForSubject = useMemo(
    () =>
      roadmap
        .filter((r) => r.subject === subject)
        .sort((a, b) => a.order_index - b.order_index),
    [roadmap, subject]
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelectedTopicId(currentBaseline[subject] ?? "");
    }
  }

  function onSubjectChange(next: Subject) {
    setSubject(next);
    setSelectedTopicId(currentBaseline[next] ?? "");
  }

  async function onSave() {
    if (!selectedTopicId) {
      toast.error("Choose a roadmap topic first");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}/roadmap-position`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, roadmap_id: selectedTopicId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to set the roadmap starting point");
      }
      toast.success(`${subject === "english" ? "English" : "Math"} starting point set`, {
        description:
          "The student's roadmap now begins here. Once progress is recorded, automatic recommendation takes over as usual.",
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function onClear(subjectToClear: Subject) {
    setIsClearing(subjectToClear);
    try {
      const res = await fetch(
        `/api/students/${studentId}/roadmap-position?subject=${subjectToClear}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to clear the starting point");
      }
      toast.success("Switched back to automatic progress tracking");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsClearing(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <MapPin className="h-3.5 w-3.5" />
            Set roadmap starting point
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set roadmap starting point</DialogTitle>
            <DialogDescription>
              Choose where this student&apos;s roadmap should begin in Grade {grade}. Existing progress history is
              preserved. Once a session is logged at or beyond this topic, automatic recommendation takes over and
              advances the student through the roadmap as usual — this isn&apos;t a permanent pin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Subject</Label>
              <div className="flex gap-2">
                {SUBJECTS.map((s) => (
                  <Button
                    key={s.value}
                    type="button"
                    size="sm"
                    variant={subject === s.value ? "default" : "outline"}
                    onClick={() => onSubjectChange(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Starting point</Label>
              {topicsForSubject.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No roadmap topics defined for Grade {grade} {subject === "english" ? "English" : "Math"} yet.
                </p>
              ) : (
                <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select roadmap topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topicsForSubject.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={isSaving || topicsForSubject.length === 0}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save starting point
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {SUBJECTS.filter((s) => currentBaseline[s.value]).map((s) => (
        <Button
          key={s.value}
          variant="ghost"
          size="sm"
          onClick={() => onClear(s.value)}
          disabled={isClearing === s.value}
          title={`Clear ${s.label} starting point — use automatic progress tracking`}
        >
          {isClearing === s.value ? <Loader2 className="animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Clear {s.label} starting point
        </Button>
      ))}
    </div>
  );
}
