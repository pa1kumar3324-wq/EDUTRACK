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
});

export type VolunteerFormValues = z.infer<typeof volunteerSchema>;
