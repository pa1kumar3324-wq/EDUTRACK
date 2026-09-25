"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPicker } from "@/components/shared/StatusPicker";
import { EffortScorePicker } from "@/components/progress/EffortScorePicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LearningRoadmapEntry, Progress, Subject, UnderstandingStatus } from "@/lib/types/database";

/**
 * Admin-only correction tool for a debrief that's already been logged —
 * fixing a mis-typed topic, a wrong status click, or a typo in a homework
 * note, without asking the original volunteer to re-file anything.
 *
 * Deliberately doesn't touch verification: a corrected VERIFIED debrief
 * stays verified (its content was wrong, not its provenance), and a
 * corrected PENDING one stays pending for its Learning Circle lead — this
 * dialog edits what was taught, not whether it's been recorded.
 *
 * The topic pickers mirror ProgressForm's roadmap-backed Select + free-text
 * fallback, for the same reason: a free-typed topic that doesn't exactly
 * match the roadmap fails the server-side validateTopicAgainstRoadmap
 * check silently otherwise (see app/api/progress/[id]/route.ts).
 */
export function EditProgressDialog({
  entry,
  roadmap,
}: {
  entry: Pick<
    Progress,
    | "id"
    | "english_topic"
    | "english_status"
    | "english_roadmap_id"
    | "math_topic"
    | "math_status"
    | "math_roadmap_id"
    | "homework"
    | "notes"
    | "effort_score"
  >;
  /** Full grade roadmap (both subjects) — filtered internally, same as ProgressForm. */
  roadmap: LearningRoadmapEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [englishTopic, setEnglishTopic] = useState(entry.english_topic ?? "");
  const [englishRoadmapId, setEnglishRoadmapId] = useState<string | null>(entry.english_roadmap_id ?? null);
  const [englishStatus, setEnglishStatus] = useState<UnderstandingStatus | undefined>(
    entry.english_status ?? undefined
  );
  const [mathTopic, setMathTopic] = useState(entry.math_topic ?? "");
  const [mathRoadmapId, setMathRoadmapId] = useState<string | null>(entry.math_roadmap_id ?? null);
  const [mathStatus, setMathStatus] = useState<UnderstandingStatus | undefined>(entry.math_status ?? undefined);
  const [homework, setHomework] = useState(entry.homework ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  // Historical rows can have effort_score = NULL ("not rated"); the admin
  // edit schema is deliberately non-nullable (see progressEditSchema in
  // lib/validations/progress.ts), so this UI can only ever correct an
  // existing score to another 1-10 value — never clear one back to NULL.
  // Leaving this undefined and never touching the picker simply omits
  // effort_score from the PATCH payload, which is what "no change" means.
  const [effortScore, setEffortScore] = useState<number | undefined>(entry.effort_score ?? undefined);

  const topicsBySubject: Record<Subject, LearningRoadmapEntry[]> = useMemo(() => {
    const bySubject = (subject: Subject) =>
      roadmap.filter((r) => r.subject === subject).sort((a, b) => a.order_index - b.order_index);
    return { english: bySubject("english"), math: bySubject("math") };
  }, [roadmap]);

  function selectTopic(subject: Subject, roadmapId: string) {
    const found = topicsBySubject[subject].find((t) => t.id === roadmapId);
    if (!found) return;
    if (subject === "english") {
      setEnglishTopic(found.topic);
      setEnglishRoadmapId(found.id);
    } else {
      setMathTopic(found.topic);
      setMathRoadmapId(found.id);
    }
  }

  async function onSave() {
    if (!englishTopic.trim() && !mathTopic.trim()) {
      toast.error("Keep at least one subject. Clear both to remove this entirely instead.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/progress/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          english_topic: englishTopic,
          english_status: englishStatus ?? null,
          english_roadmap_id: englishRoadmapId,
          math_topic: mathTopic,
          math_status: mathStatus ?? null,
          math_roadmap_id: mathRoadmapId,
          homework,
          notes,
          effort_score: effortScore,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save changes");

      toast.success("Debrief updated");
      setOpen(false);
      // Re-fetches this page's server data (roadmap position, weak areas,
      // journey charts, etc. all derive from this row) rather than trying
      // to patch every downstream computation client-side.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit debrief</DialogTitle>
          <DialogDescription>
            Correct what was logged. This doesn&apos;t change who filed it, when, or its verification status.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>📘 English topic</Label>
            {topicsBySubject.english.length > 0 ? (
              <Select value={englishRoadmapId ?? undefined} onValueChange={(v) => selectTopic("english", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a topic">{englishTopic || undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {topicsBySubject.english.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={englishTopic}
                onChange={(e) => {
                  setEnglishTopic(e.target.value);
                  setEnglishRoadmapId(null);
                }}
                placeholder="e.g. Reading comprehension: short passages"
              />
            )}
            <StatusPicker
              label="English understanding"
              value={englishStatus}
              onChange={(v) => setEnglishStatus(v as UnderstandingStatus)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>🔢 Math topic</Label>
            {topicsBySubject.math.length > 0 ? (
              <Select value={mathRoadmapId ?? undefined} onValueChange={(v) => selectTopic("math", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a topic">{mathTopic || undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {topicsBySubject.math.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={mathTopic}
                onChange={(e) => {
                  setMathTopic(e.target.value);
                  setMathRoadmapId(null);
                }}
                placeholder="e.g. Two-digit addition with regrouping"
              />
            )}
            <StatusPicker
              label="Math understanding"
              value={mathStatus}
              onChange={(v) => setMathStatus(v as UnderstandingStatus)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label id="edit-effort-score-label">⭐ Effort score</Label>
            <EffortScorePicker
              id="edit-effort-score"
              value={effortScore}
              onChange={setEffortScore}
            />
          </div>

          <div>
            <Label htmlFor="edit-homework">Homework</Label>
            <Textarea id="edit-homework" rows={2} value={homework} onChange={(e) => setHomework(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
