"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProgressFormValues } from "@/lib/validations/progress";
import type { Progress } from "@/lib/types/database";

/** Shape returned by POST /api/progress. Math and English suggestions are
 * independent — each is null when that subject wasn't recorded this
 * session, and never silently discarded when both are present. */
export interface SubmitProgressResult {
  progress: Progress;
  mathSuggestion: string | null;
  englishSuggestion: string | null;
  /** Backwards-compatible combined field (also what's persisted to `progress.suggested_next_lesson`). */
  suggestedNextLesson?: string;
}

/**
 * Submits a progress update via the API route (which handles the suggestion
 * engine + repository write server-side) and surfaces toasts/loading state.
 */
export function useProgress() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitProgress(values: ProgressFormValues): Promise<SubmitProgressResult> {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save progress");
      }

      const data: SubmitProgressResult = await res.json();
      toast.success("Progress saved", {
        description: data.mathSuggestion ?? data.englishSuggestion ?? "The student's timeline has been updated.",
      });
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submitProgress, isSubmitting };
}
