"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { GripVertical, Loader2, Plus, Trash2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { roadmapEntrySchema, type RoadmapEntryFormValues } from "@/lib/validations/roadmap";
import type { LearningRoadmapEntry } from "@/lib/types/database";
const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

export function RoadmapBuilder({ initialEntries }: { initialEntries: LearningRoadmapEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [grade, setGrade] = useState(5);
  const [subject, setSubject] = useState<"english" | "math">("english");
  const [isSaving, setIsSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LearningRoadmapEntry | null>(null);
  const reduceMotion = useReducedMotion();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoadmapEntryFormValues>({
    resolver: zodResolver(roadmapEntrySchema),
    defaultValues: { grade, subject, topic: "", description: "", order_index: 1 },
  });

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => e.grade === grade && e.subject === subject)
        .sort((a, b) => a.order_index - b.order_index),
    [entries, grade, subject]
  );

  async function onAdd(values: RoadmapEntryFormValues) {
    setIsSaving(true);
    try {
      const nextOrder = filtered.length > 0 ? Math.max(...filtered.map((e) => e.order_index)) + 1 : 1;
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, grade, subject, order_index: nextOrder }),
      });
      if (!res.ok) throw new Error("Failed to add topic");
      const { entry } = await res.json();
      setEntries((prev) => [...prev, entry]);
      reset({ grade, subject, topic: "", description: "", order_index: nextOrder + 1 });
      toast.success("Topic added to roadmap");
    } catch {
      toast.error("Failed to add topic");
    } finally {
      setIsSaving(false);
    }
  }

  /** Called after a drag-to-reorder gesture settles. Re-indexes the filtered
   *  slice locally for instant feedback, then persists only the entries
   *  whose order actually changed. */
  async function handleReorder(next: LearningRoadmapEntry[]) {
    const changed: { id: string; order_index: number }[] = [];
    const reindexed = next.map((entry, i) => {
      const order_index = i + 1;
      if (entry.order_index !== order_index) changed.push({ id: entry.id, order_index });
      return { ...entry, order_index };
    });

    setEntries((prev) => {
      const others = prev.filter((e) => !(e.grade === grade && e.subject === subject));
      return [...others, ...reindexed];
    });

    if (changed.length === 0) return;
    try {
      await Promise.all(
        changed.map((c) =>
          fetch(`/api/roadmap/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_index: c.order_index }),
          })
        )
      );
    } catch {
      toast.error("Failed to save the new order — refresh to see the last saved order.");
    }
  }

  async function remove(entry: LearningRoadmapEntry) {
    const res = await fetch(`/api/roadmap/${entry.id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success("Topic removed");
    } else {
      toast.error("Failed to remove topic");
      throw new Error("Failed to remove topic");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subject} onValueChange={(v) => setSubject(v as "english" | "math")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="math">Math</SelectItem>
              </SelectContent>
            </Select>
            {filtered.length > 1 && (
              <p className="text-xs text-muted-foreground">Drag <GripVertical className="inline h-3 w-3 align-text-bottom" /> to reorder</p>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Map} title="No topics yet" description={`Add the first topic for Grade ${grade} ${subject}.`} />
          ) : (
            <Reorder.Group
              as="ol"
              axis="y"
              values={filtered}
              onReorder={handleReorder}
              className="flex flex-col gap-2"
            >
              {filtered.map((entry, i) => (
                <RoadmapRow
                  key={entry.id}
                  entry={entry}
                  index={i}
                  onRemove={() => setRemoveTarget(entry)}
                  reduceMotion={!!reduceMotion}
                />
              ))}
            </Reorder.Group>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardContent className="p-5">
          <h3 className="mb-3 font-display text-sm font-semibold">Add topic</h3>
          <form onSubmit={handleSubmit(onAdd)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" {...register("topic")} placeholder="e.g. Equivalent fractions" />
              {errors.topic && <p className="text-xs text-destructive">{errors.topic.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" {...register("description")} placeholder="One line for volunteers" />
            </div>
            <p className="text-xs text-muted-foreground">
              Will be added to the end of Grade {grade} {subject}.
            </p>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
              Add to roadmap
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this topic?"
        description={removeTarget ? `Remove "${removeTarget.topic}" from the roadmap?` : ""}
        confirmLabel="Remove topic"
        onConfirm={() => {
          if (removeTarget) return remove(removeTarget);
        }}
      />
    </div>
  );
}

function RoadmapRow({
  entry,
  index,
  onRemove,
  reduceMotion,
}: {
  entry: LearningRoadmapEntry;
  index: number;
  onRemove: () => void;
  reduceMotion: boolean;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="li"
      value={entry}
      dragListener={false}
      dragControls={controls}
      layout
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-soft"
      whileDrag={reduceMotion ? undefined : { scale: 1.02, boxShadow: "0 8px 28px -6px rgb(30 20 10 / 0.18)" }}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-secondary active:cursor-grabbing"
        aria-label={`Reorder "${entry.topic}"`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.topic}</p>
        {entry.description && <p className="truncate text-xs text-muted-foreground">{entry.description}</p>}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove "${entry.topic}"`}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </Reorder.Item>
  );
}
