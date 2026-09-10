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
