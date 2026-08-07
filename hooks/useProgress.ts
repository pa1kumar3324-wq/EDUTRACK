"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProgressFormValues } from "@/lib/validations/progress";

/**
 * Submits a progress update via the API route (which handles the suggestion
 * engine + repository write server-side) and surfaces toasts/loading state.
 */
export function useProgress() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitProgress(values: ProgressFormValues) {
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

      const data = await res.json();
      toast.success("Progress saved", {
        description: data.suggestedNextLesson ?? "The student's timeline has been updated.",
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
