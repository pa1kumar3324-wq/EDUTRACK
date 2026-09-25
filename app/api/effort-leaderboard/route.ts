import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { effortRepository } from "@/lib/repositories/effortRepository";

/**
 * GET /api/effort-leaderboard?circleId= — any authenticated user (volunteer
 * or admin), same as everything else built on top of `progress` (RLS's
 * `progress_select_all` already lets every authenticated user read
 * progress history — this endpoint surfaces an aggregate of that same
 * data, not anything more sensitive). Omit `circleId` for the
 * organization-wide "All Students" leaderboard.
 */
export async function GET(request: Request) {
  try {
    await requireUserApi();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const circleId = searchParams.get("circleId") || undefined;

    const rows = await effortRepository.leaderboard(supabase, circleId);
    return NextResponse.json({ rows });
  } catch (error) {
    return apiError(error);
  }
}
