import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { effortRepository } from "@/lib/repositories/effortRepository";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { EffortLeaderboardPanel } from "@/components/shared/EffortLeaderboardPanel";

/**
 * Effort Leaderboard — ranked by average Weekly Effort Score, not academic
 * performance. Open to every authenticated user (volunteer or admin), same
 * as the progress data it's aggregated from (`progress_select_all` already
 * lets any authenticated user read every student's session history). Only
 * the "Download Leaderboard" export is admin-only, matching every other
 * export in the app (see app/api/export/route.ts).
 *
 * Circles list + the default "All Students" scope are fetched server-side;
 * switching scope afterwards re-fetches client-side via
 * GET /api/effort-leaderboard (see EffortLeaderboardPanel).
 */
export default async function EffortLeaderboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [rows, circles] = await Promise.all([
    effortRepository.leaderboard(supabase),
    learningCircleRepository.list(supabase),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Effort Leaderboard"
        description="Who's bringing the most effort, participation, and persistence this term — not who's getting the most right."
      />
      <EffortLeaderboardPanel
        circles={circles.map((c) => ({ id: c.id, name: c.name }))}
        initialRows={rows}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
