"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { progressSchema, type ProgressFormValues } from "@/lib/validations/progress";
import { useProgress } from "@/hooks/useProgress";
import type { Student } from "@/lib/types/database";

const STATUS_OPTIONS = [
  { value: "independent", label: "🟢 Independent" },
  { value: "needs_help", label: "🟡 Needs Help" },
  { value: "not_understood", label: "🔴 Didn't Understand" },
];

export function ProgressForm({ student }: { student: Student }) {
  const router = useRouter();
  const { submitProgress, isSubmitting } = useProgress();
  const [showSuccess, setShowSuccess] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProgressFormValues>({
    resolver: zodResolver(progressSchema),
    defaultValues: { student_id: student.id },
  });

  async function onSubmit(values: ProgressFormValues) {
    const result = await submitProgress(values);
    setSuggestion(result.suggestedNextLesson ?? null);
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
        {suggestion && (
          <div className="mt-2 max-w-md rounded-xl bg-card px-4 py-3 text-left text-sm shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Suggested Next Lesson</p>
            <p className="mt-1 text-foreground">{suggestion}</p>
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
              <Input id="english_topic" placeholder="e.g. Equivalent fractions" {...register("english_topic")} />
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
              <Input id="math_topic" placeholder="e.g. Long division" {...register("math_topic")} />
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
