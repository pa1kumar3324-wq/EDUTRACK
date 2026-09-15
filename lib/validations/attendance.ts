import { z } from "zod";
import { dateStringSchema } from "@/lib/validations/dateString";

export const attendanceSchema = z.object({
  volunteer_id: z.string().uuid(),
  session_date: dateStringSchema,
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type AttendanceFormValues = z.infer<typeof attendanceSchema>;

/** Bulk mark — same date/status applied to a set of volunteers in one request. */
export const bulkAttendanceSchema = z.object({
  volunteer_ids: z.array(z.string().uuid()).min(1),
  session_date: dateStringSchema,
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type BulkAttendanceFormValues = z.infer<typeof bulkAttendanceSchema>;
