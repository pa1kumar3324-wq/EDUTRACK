import { z } from "zod";

/**
 * Editable "profile" fields — distinct from official/admin fields (name,
 * email, role, is_active), which stay on volunteerSchema in
 * lib/validations/roadmap.ts and are only ever changed via the admin-only
 * /api/volunteers/:id route.
 *
 * Used by:
 *  - POST/PATCH /api/profile (self-service — see app/api/profile/route.ts)
 *  - the admin route's volunteerSchema, spread in as optional fields, so an
 *    admin can also edit another volunteer's profile info.
 */
export const volunteerProfileSchema = z.object({
  // Official name — required, mirrors the rule on `name` in volunteerSchema
  // (lib/validations/roadmap.ts). Unlike the fields below, this is never
  // nullable and never coerced to null on empty input; see
  // normalizeProfilePatch().
  name: z.string().min(2).max(100),
  preferred_name: z.string().max(100).nullable().optional().or(z.literal("")),
  avatar_url: z.string().url().nullable().optional().or(z.literal("")),
  bio: z.string().max(1000).nullable().optional().or(z.literal("")),
  teaching_interests: z.string().max(500).nullable().optional().or(z.literal("")),
  fun_fact: z.string().max(280).nullable().optional().or(z.literal("")),
  // Plain "YYYY-MM-DD" from a <input type="date">, or null/"" to clear.
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type VolunteerProfileFormValues = z.infer<typeof volunteerProfileSchema>;

/**
 * Normalizes form values before hitting the DB: empty strings become null
 * (so "clearing" a field actually clears it) and preferred_name is trimmed
 * so whitespace-only input falls back to the official name via
 * displayName() rather than rendering blank.
 */
export function normalizeProfilePatch(values: Partial<VolunteerProfileFormValues>) {
  const patch: Record<string, string | null> = {};

  // `name` is required and must never be nulled out on empty input — handle
  // it separately from the nullable-fields loop below (just trim it).
  if ("name" in values && typeof values.name === "string") {
    patch.name = values.name.trim();
  }

  for (const key of ["preferred_name", "avatar_url", "bio", "teaching_interests", "fun_fact", "date_of_birth"] as const) {
    if (!(key in values)) continue;
    const raw = values[key];
    const trimmed = typeof raw === "string" ? raw.trim() : raw;
    patch[key] = trimmed ? trimmed : null;
  }
  return patch;
}
