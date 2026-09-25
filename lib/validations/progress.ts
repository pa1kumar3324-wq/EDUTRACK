import { z } from "zod";
import { sessionObservationsSchema } from "@/lib/validations/sessionObservations";

export const progressSchema = z
  .object({
    student_id: z.string().uuid(),
    english_topic: z.string().max(200).optional().or(z.literal("")),
    english_status: z.enum(["independent", "needs_help", "not_understood"]).optional(),
    // Set by ProgressForm when the topic came from the roadmap-backed Select
    // (rather than the free-text fallback). Server-validated/derived in
    // app/api/progress/route.ts — never trusted blindly.
    english_roadmap_id: z.string().uuid().optional().nullable(),
    math_topic: z.string().max(200).optional().or(z.literal("")),
    math_status: z.enum(["independent", "needs_help", "not_understood"]).optional(),
    math_roadmap_id: z.string().uuid().optional().nullable(),
    homework: z.string().max(1000).optional().or(z.literal("")),
    notes: z.string().max(2000).optional().or(z.literal("")),
    // Rich, structured per-session observations (mood, participation,
    // lesson execution, teaching approach, outcome, session quality — see
    // lib/types/sessionObservations.ts). Entirely optional and additive;
    // omitting it changes nothing about existing progress semantics.
    session_observations: sessionObservationsSchema.optional(),
    // Weekly Effort Score: how much the student participated, persisted,
    // and tried today — never how correct their English/Math answers were.
    // Required for every NEW submission (ProgressForm always renders the
    // picker), so this is a plain required number, not `.optional()` —
    // unlike session_observations, which is skippable rich detail. Existing
    // historical rows keep effort_score = NULL regardless of this schema;
    // this only governs what a NEW submission must include. See
    // components/progress/EffortScorePicker.tsx for the picker and its
    // helper text.
    effort_score: z
      .number({ required_error: "Rate the student's effort before submitting" })
      .int()
      .min(1, "Effort score must be between 1 and 10")
      .max(10, "Effort score must be between 1 and 10"),
  })
  .refine((data) => data.english_topic || data.math_topic, {
    message: "Log at least one subject taught this session",
    path: ["english_topic"],
  });

export type ProgressFormValues = z.infer<typeof progressSchema>;

/**
 * PATCH /api/progress/[id] — an admin correcting an existing debrief's
 * taught content (wrong topic, mis-clicked status, a typo in homework).
 * Deliberately narrower than progressSchema: no student_id (the row's
 * student never changes), no session_observations (editing rich per-session
 * detail after the fact reads as rewriting history rather than fixing a
 * clerical error — leave that to the original author's next entry), and
 * every field optional since an edit only sends what changed.
 *
 * The "at least one subject" invariant progressSchema enforces at creation
 * is re-checked in the route handler instead of here, against the MERGED
 * result of existing row + this patch — a valid edit can legitimately clear
 * one subject's topic as long as the other still has one, which a
 * standalone schema refinement on the patch alone can't express.
 */
export const progressEditSchema = z
  .object({
    english_topic: z.string().max(200).optional().or(z.literal("")),
    english_status: z.enum(["independent", "needs_help", "not_understood"]).optional().nullable(),
    english_roadmap_id: z.string().uuid().optional().nullable(),
    math_topic: z.string().max(200).optional().or(z.literal("")),
    math_status: z.enum(["independent", "needs_help", "not_understood"]).optional().nullable(),
    math_roadmap_id: z.string().uuid().optional().nullable(),
    homework: z.string().max(1000).optional().or(z.literal("")),
    notes: z.string().max(2000).optional().or(z.literal("")),
    // An ordinary correction to the debrief, same as topic/homework/notes —
    // NOT a verification-state change (guard_debrief_verification only
    // watches learning_circle_id/verification_status and is untouched by
    // this). Deliberately plain `.optional()`, no `.nullable()`: there's no
    // existing pattern in this schema for clearing effort_score back to
    // "not rated" via the admin edit UI, so this only ever corrects it to
    // another value in range, matching the 1-10 CHECK constraint.
    effort_score: z
      .number()
      .int()
      .min(1, "Effort score must be between 1 and 10")
      .max(10, "Effort score must be between 1 and 10")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

export type ProgressEditValues = z.infer<typeof progressEditSchema>;
