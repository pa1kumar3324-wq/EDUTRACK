import { z } from "zod";

/** Body shape for POST/DELETE /api/assignments — validated so a malformed
 * or malicious payload (wrong type, SQL-injection attempt via a non-UUID
 * string, etc.) is rejected with a clean 400 before it ever reaches
 * Postgres, rather than surfacing as a raw driver error. */
export const assignmentSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid id"),
  volunteerId: z.string().uuid("volunteerId must be a valid id"),
});

export type AssignmentValues = z.infer<typeof assignmentSchema>;
