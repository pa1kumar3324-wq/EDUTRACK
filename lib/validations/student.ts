import { z } from "zod";

export const studentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  grade: z.coerce.number().int().min(1).max(12),
  english_level: z.enum(["beginner", "developing", "proficient", "advanced"]),
  math_level: z.enum(["beginner", "developing", "proficient", "advanced"]),
  // L9: restrict to https:// as defense in depth (rendered via a plain
  // <img>, not next/image, so there's no SSRF path either way — only an
  // already-admin user can set this).
  photo_url: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"), { message: "Photo URL must use https://" })
    .nullable()
    .optional()
    .or(z.literal("")),
  guardian_name: z.string().max(100).nullable().optional().or(z.literal("")),
  guardian_phone: z.string().max(30).nullable().optional().or(z.literal("")),
  notes: z.string().max(2000).nullable().optional().or(z.literal("")),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
