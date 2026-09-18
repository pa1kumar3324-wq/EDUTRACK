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
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

export type ProgressEditValues = z.infer<typeof progressEditSchema>;
