import { z } from "zod";

export const progressSchema = z
  .object({
    student_id: z.string().uuid(),
    english_topic: z.string().max(200).optional().or(z.literal("")),
    english_status: z.enum(["independent", "needs_help", "not_understood"]).optional(),
    math_topic: z.string().max(200).optional().or(z.literal("")),
    math_status: z.enum(["independent", "needs_help", "not_understood"]).optional(),
    homework: z.string().max(1000).optional().or(z.literal("")),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine((data) => data.english_topic || data.math_topic, {
    message: "Log at least one subject taught this session",
    path: ["english_topic"],
  });

export type ProgressFormValues = z.infer<typeof progressSchema>;
