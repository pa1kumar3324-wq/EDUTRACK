import { z } from "zod";

/**
 * Strict YYYY-MM-DD date string. Used for both API query params (export,
 * attendance) and form fields (volunteer date_of_birth) so a malformed
 * value is rejected with a clean Zod error instead of a raw Postgres
 * type-cast error reaching the client. Matches the format
 * `volunteerProfileSchema.date_of_birth` already used.
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a valid date (YYYY-MM-DD)");
