"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { roadmapEntrySchema, type RoadmapEntryFormValues } from "@/lib/validations/roadmap";
import type { LearningRoadmapEntry } from "@/lib/types/database";
const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

export function RoadmapBuilder({ initialEntries }: { initialEntries: LearningRoadmapEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [grade, setGrade] = useState(5);
  const [subject, setSubject] = useState<"english" | "math">("english");
  const [isSaving, setIsSaving] = useState(false);

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

  async function move(entry: LearningRoadmapEntry, direction: -1 | 1) {
    const idx = filtered.findIndex((e) => e.id === entry.id);
    const swapWith = filtered[idx + direction];
    if (!swapWith) return;

    const [a, b] = [entry.order_index, swapWith.order_index];
    await Promise.all([
      fetch(`/api/roadmap/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: b }),
      }),
      fetch(`/api/roadmap/${swapWith.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: a }),
      }),
    ]);
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id === entry.id) return { ...e, order_index: b };
        if (e.id === swapWith.id) return { ...e, order_index: a };
        return e;
      })
    );
  }

  async function remove(entry: LearningRoadmapEntry) {
    if (!confirm(`Remove "${entry.topic}" from the roadmap?`)) return;
    const res = await fetch(`/api/roadmap/${entry.id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success("Topic removed");
    } else {
      toast.error("Failed to remove topic");
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
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Map} title="No topics yet" description={`Add the first topic for Grade ${grade} ${subject}.`} />
          ) : (
            <ol className="flex flex-col gap-2">
              {filtered.map((entry, i) => (
                <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.topic}</p>
                    {entry.description && <p className="truncate text-xs text-muted-foreground">{entry.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(entry, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={i === filtered.length - 1} onClick={() => move(entry, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(entry)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
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
    </div>
  );
}
