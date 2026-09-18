import { z } from "zod";

/**
 * Body shapes for the Learning Circle + debrief verification API routes.
 *
 * Same reasoning as lib/validations/assignment.ts: a malformed or malicious
 * payload is rejected with a clean 400 before it reaches Postgres, rather
 * than surfacing as a raw driver error. Note that these schemas deliberately
 * contain NO `verification_status` for the progress-write path — that value
 * is derived by a database trigger and is never client input (see
 * supabase/migrations/008_learning_circles.sql).
 */

export const learningCircleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the circle a name")
    .max(120, "Name must be 120 characters or fewer"),
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer").optional().or(z.literal("")),
  /** Must be an active admin — also enforced in the DB by trg_learning_circle_lead_must_be_admin. */
  lead_admin_id: z.string().uuid("Pick an admin to lead this circle"),
  /**
   * Optional initial roster. Members can equally be managed afterwards via
   * the members endpoint; this just makes "create a circle with these five
   * volunteers" a single round trip.
   */
  member_ids: z.array(z.string().uuid()).max(500).optional(),
});

export type LearningCircleFormValues = z.infer<typeof learningCircleSchema>;

/** PATCH /api/learning-circles/[id] — every field optional. */
export const learningCircleUpdateSchema = learningCircleSchema
  .omit({ member_ids: true })
  .partial()
  .extend({ is_active: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update" });

export type LearningCircleUpdateValues = z.infer<typeof learningCircleUpdateSchema>;

/**
 * PUT /api/learning-circles/[id]/members — the full desired roster.
 * Declarative rather than add/remove deltas, so the UI can't drift out of
 * sync with the server after a partially-failed batch.
 */
export const circleMembersSchema = z.object({
  volunteer_ids: z.array(z.string().uuid()).max(500),
});

export type CircleMembersValues = z.infer<typeof circleMembersSchema>;

/**
 * POST /api/debriefs/[id]/verify — the lead admin's decision on a pending
 * debrief. "verify" records it; "reject" sends it back. Both accept an
 * optional note, which is what makes a rejection actionable for the
 * volunteer who filed it.
 */
export const debriefVerificationSchema = z.object({
  action: z.enum(["verify", "reject"], {
    errorMap: () => ({ message: "Action must be verify or reject" }),
  }),
  notes: z.string().trim().max(1000, "Note must be 1000 characters or fewer").optional().or(z.literal("")),
});

export type DebriefVerificationValues = z.infer<typeof debriefVerificationSchema>;
