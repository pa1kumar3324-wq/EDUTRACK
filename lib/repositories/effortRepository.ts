import { createClient } from "@/lib/supabase/server";
import type { EffortLeaderboardRow } from "@/lib/types/database";

type Client = Awaited<ReturnType<typeof createClient>>;

export const effortRepository = {
  /**
   * The Effort Leaderboard, optionally scoped to one Learning Circle.
   *
   * These are two DIFFERENT aggregations, not one view filtered two ways:
   *
   *   - No circleId ("All Students"): `student_effort_leaderboard` — each
   *     active rated student's org-wide average, joined only for DISPLAY to
   *     the circle that logged their most recent rated session.
   *   - circleId given: `student_effort_leaderboard_by_circle` — that
   *     circle's own average/count, computed only from verified, rated
   *     `progress` rows whose learning_circle_id is that circle. A student
   *     taught through multiple circles gets a different row (and a
   *     different average) per circle, which is why this can't just be a
   *     `.eq("learning_circle_id", ...)` filter over the all-students view:
   *     that view already collapsed each student to a single "credited"
   *     circle before this filter would ever run, so a student whose
   *     credited circle isn't the one being viewed would wrongly vanish
   *     (or, worse, surface under the wrong circle with the wrong average).
   *
   * Both views already do the AVG(effort_score)/COUNT(effort_score)
   * grouping in Postgres (see supabase/migrations/011_effort_score.sql), so
   * either way this is exactly one query, never one query per student.
   *
   * Ranking: average effort DESC, then sessions-rated DESC (a student with
   * more ratings backing the same average outranks one with very few — see
   * the feature spec's ranking rules). Never falls back to academic
   * performance/status as a tiebreaker.
   */
  async leaderboard(supabase: Client, circleId?: string): Promise<EffortLeaderboardRow[]> {
    if (circleId) {
      const { data, error } = await supabase
        .from("student_effort_leaderboard_by_circle")
        .select("*")
        .eq("learning_circle_id", circleId)
        .order("average_effort_score", { ascending: false })
        .order("effort_score_count", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    const { data, error } = await supabase
      .from("student_effort_leaderboard")
      .select("*")
      .order("average_effort_score", { ascending: false })
      .order("effort_score_count", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** One student's effort summary for the profile page, or null if never rated. */
  async forStudent(supabase: Client, studentId: string): Promise<EffortLeaderboardRow | null> {
    const { data, error } = await supabase
      .from("student_effort_leaderboard")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
