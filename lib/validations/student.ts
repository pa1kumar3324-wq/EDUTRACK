import { z } from "zod";

export const studentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  grade: z.coerce.number().int().min(1).max(12),
  english_level: z.enum(["beginner", "developing", "proficient", "advanced"]),
  math_level: z.enum(["beginner", "developing", "proficient", "advanced"]),
  photo_url: z.string().url().nullable().optional().or(z.literal("")),
  guardian_name: z.string().max(100).nullable().optional().or(z.literal("")),
  guardian_phone: z.string().max(30).nullable().optional().or(z.literal("")),
  notes: z.string().max(2000).nullable().optional().or(z.literal("")),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
