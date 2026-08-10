import { z } from "zod";

/** Body for PUT /api/students/:id/roadmap-position — set (create or replace) the roadmap starting baseline. */
export const roadmapPositionSchema = z.object({
  subject: z.enum(["english", "math"]),
  roadmap_id: z.string().uuid("roadmap_id must be a valid roadmap topic id"),
});

export type RoadmapPositionFormValues = z.infer<typeof roadmapPositionSchema>;

/** Query param for GET/DELETE /api/students/:id/roadmap-position?subject=. */
export const roadmapPositionSubjectQuerySchema = z.object({
  subject: z.enum(["english", "math"]),
});
