"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProgressFormValues } from "@/lib/validations/progress";
import type { DebriefVerificationStatus, Progress } from "@/lib/types/database";

/** Shape returned by POST /api/progress. Math and English suggestions are
 * independent — each is null when that subject wasn't recorded this
 * session, and never silently discarded when both are present. */
export interface SubmitProgressResult {
  progress: Progress;
  mathSuggestion: string | null;
  englishSuggestion: string | null;
  /** Backwards-compatible combined field (also what's persisted to `progress.suggested_next_lesson`). */
  suggestedNextLesson?: string;
  /**
   * Whether this debrief went straight into the record or is waiting on a
   * Learning Circle lead admin. Optional so a client running against an
   * older server (or a cached response) degrades to the original
   * "recorded immediately" assumption rather than throwing.
   */
  verificationStatus?: DebriefVerificationStatus;
  awaitingVerification?: boolean;
  verifyingCircle?: { id: string; name: string; leadName: string | null } | null;
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

      // Two genuinely different outcomes, so two different messages. A
      // debrief filed by a Learning Circle member isn't recorded until its
      // lead admin verifies it — telling the volunteer "Progress saved"
      // either way would leave them believing the session already counts.
      if (data.awaitingVerification) {
        const lead = data.verifyingCircle?.leadName;
        toast.success("Debrief submitted for verification", {
          description: lead
            ? `${lead} will review it for ${data.verifyingCircle?.name}. It's recorded once verified.`
            : "Your Learning Circle lead will review it. It's recorded once verified.",
        });
      } else {
        toast.success("Progress saved", {
          description: data.mathSuggestion ?? data.englishSuggestion ?? "The student's timeline has been updated.",
        });
      }

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
