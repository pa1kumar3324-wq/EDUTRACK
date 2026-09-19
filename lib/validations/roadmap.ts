import { z } from "zod";

export const roadmapEntrySchema = z.object({
  grade: z.coerce.number().int().min(1).max(12),
  subject: z.enum(["english", "math"]),
  topic: z.string().min(2).max(150),
  description: z.string().max(500).optional().or(z.literal("")),
  order_index: z.coerce.number().int().min(1),
});

export type RoadmapEntryFormValues = z.infer<typeof roadmapEntrySchema>;

export const volunteerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional().or(z.literal("")),
  role: z.enum(["admin", "volunteer"]),
  // Admin-only: deactivate/reactivate. Deactivation itself goes through
  // DELETE (see app/api/volunteers/[id]/route.ts), which also revokes live
  // sessions; this lets that same route's PATCH handle reactivation via
  // `{ is_active: true }`, since there was previously no way to undo a
  // deactivation through the UI.
  is_active: z.boolean().optional(),
  // Profile fields — optional, and only ever set via admin edits of another
  // volunteer's profile here (see lib/validations/volunteerProfile.ts for
  // the shared shape and the self-service path in app/api/profile/route.ts).
  preferred_name: z.string().max(100).nullable().optional().or(z.literal("")),
  avatar_url: z.string().url().nullable().optional().or(z.literal("")),
  bio: z.string().max(1000).nullable().optional().or(z.literal("")),
  teaching_interests: z.string().max(500).nullable().optional().or(z.literal("")),
  fun_fact: z.string().max(280).nullable().optional().or(z.literal("")),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type VolunteerFormValues = z.infer<typeof volunteerSchema>;

/**
 * POST /api/volunteers (invite flow) intentionally accepts a smaller shape
 * than volunteerSchema above — an invite only ever sets name/email/phone/
 * role up front; the richer profile fields (bio, avatar, etc.) are always
 * filled in later by the volunteer themself via /api/profile. Kept as its
 * own schema (rather than volunteerSchema.pick(...)) so this validation
 * doesn't silently drift if profile-only fields are ever added/removed
 * from volunteerSchema.
 */
export const volunteerInviteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().max(30).optional().or(z.literal("")),
  role: z.enum(["admin", "volunteer"]).optional(),
});

export type VolunteerInviteValues = z.infer<typeof volunteerInviteSchema>;
