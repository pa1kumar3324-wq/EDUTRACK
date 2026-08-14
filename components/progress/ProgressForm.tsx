"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { progressSchema, type ProgressFormValues } from "@/lib/validations/progress";
import { useProgress } from "@/hooks/useProgress";
import type { LearningRoadmapEntry, Student, Subject } from "@/lib/types/database";

const STATUS_OPTIONS = [
  { value: "independent", label: "🟢 Independent" },
  { value: "needs_help", label: "🟡 Needs Help" },
  { value: "not_understood", label: "🔴 Didn't Understand" },
];

export function ProgressForm({ student, roadmap }: { student: Student; roadmap: LearningRoadmapEntry[] }) {
  const router = useRouter();
  const { submitProgress, isSubmitting } = useProgress();
  const [showSuccess, setShowSuccess] = useState(false);
  const [mathSuggestion, setMathSuggestion] = useState<string | null>(null);
  const [englishSuggestion, setEnglishSuggestion] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProgressFormValues>({
    resolver: zodResolver(progressSchema),
    defaultValues: { student_id: student.id },
  });

  // Mirrors RoadmapPositionControl's grade+subject-filtered, order_index-sorted
  // dropdown pattern, so volunteers pick the exact roadmap topic instead of
  // free-typing it (the root cause of advancement silently resetting to
  // topic #1 on any typo/phrasing mismatch).
  const topicsBySubject: Record<Subject, LearningRoadmapEntry[]> = useMemo(() => {
    const bySubject = (subject: Subject) =>
      roadmap.filter((r) => r.subject === subject).sort((a, b) => a.order_index - b.order_index);
    return { english: bySubject("english"), math: bySubject("math") };
  }, [roadmap]);

  function handleTopicSelect(subject: Subject, roadmapId: string) {
    const entry = topicsBySubject[subject].find((t) => t.id === roadmapId);
    if (!entry) return;
    if (subject === "english") {
      setValue("english_topic", entry.topic);
      setValue("english_roadmap_id", entry.id);
    } else {
      setValue("math_topic", entry.topic);
      setValue("math_roadmap_id", entry.id);
    }
  }

  async function onSubmit(values: ProgressFormValues) {
    const result = await submitProgress(values);
    setMathSuggestion(result.mathSuggestion ?? null);
    setEnglishSuggestion(result.englishSuggestion ?? null);
    setShowSuccess(true);
    setTimeout(() => {
      router.push(`/students/${student.id}`);
      router.refresh();
    }, 1800);
  }

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-success/30 bg-success/5 py-16 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <CheckCircle2 className="h-14 w-14 text-success" />
        </motion.div>
        <div>
          <p className="font-display text-lg font-semibold">Progress saved</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {student.name}'s timeline has been updated. Next volunteer will see this immediately.
          </p>
        </div>
        {(mathSuggestion || englishSuggestion) && (
          <div className="mt-2 flex w-full max-w-md flex-col gap-2">
            {mathSuggestion && (
              <div className="rounded-xl bg-card px-4 py-3 text-left text-sm shadow-soft">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  {englishSuggestion ? "Math — Suggested Next Lesson" : "Suggested Next Lesson"}
                </p>
                <p className="mt-1 text-foreground">{mathSuggestion}</p>
              </div>
            )}
            {englishSuggestion && (
              <div className="rounded-xl bg-card px-4 py-3 text-left text-sm shadow-soft">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  {mathSuggestion ? "English — Suggested Next Lesson" : "Suggested Next Lesson"}
                </p>
                <p className="mt-1 text-foreground">{englishSuggestion}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>English</CardTitle>
            <CardDescription>What was taught, and how it landed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="english_topic">English taught</Label>
              {topicsBySubject.english.length > 0 ? (
                <Select onValueChange={(v) => handleTopicSelect("english", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select topic from roadmap" />
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
                <>
                  <Input id="english_topic" placeholder="e.g. Equivalent fractions" {...register("english_topic")} />
                  <p className="text-xs text-muted-foreground">
                    No roadmap defined yet for Grade {student.grade} English — logging as free text.
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Understanding</Label>
              <Select onValueChange={(v) => setValue("english_status", v as ProgressFormValues["english_status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select understanding level" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Math</CardTitle>
            <CardDescription>What was taught, and how it landed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="math_topic">Math taught</Label>
              {topicsBySubject.math.length > 0 ? (
                <Select onValueChange={(v) => handleTopicSelect("math", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select topic from roadmap" />
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
                <>
                  <Input id="math_topic" placeholder="e.g. Long division" {...register("math_topic")} />
                  <p className="text-xs text-muted-foreground">
                    No roadmap defined yet for Grade {student.grade} Math — logging as free text.
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Understanding</Label>
              <Select onValueChange={(v) => setValue("math_status", v as ProgressFormValues["math_status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select understanding level" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {errors.english_topic && (
        <p className="text-sm text-destructive">{errors.english_topic.message}</p>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="homework">Homework assigned</Label>
            <Textarea id="homework" placeholder="What should the student practice before next session?" {...register("homework")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes for the next volunteer</Label>
            <Textarea
              id="notes"
              placeholder="Anything the next volunteer should know — attention span today, what helped, what didn't..."
              {...register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Submit
        </Button>
      </div>
    </form>
  );
}
