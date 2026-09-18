import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";

/**
 * GET /api/debriefs/pending — admin only.
 *
 * Defaults to the circles the calling admin actually leads, which is the
 * only queue they can act on. `?scope=all` widens it to every pending
 * debrief program-wide for oversight; the verify action on those still
 * fails at the database, since guard_debrief_verification() only lets the
 * circle's own lead change a debrief's status.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAdminApi();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");

    const debriefs = await learningCircleRepository.listPendingDebriefs(
      supabase,
      scope === "all" ? null : user.id
    );

    return NextResponse.json({ debriefs, scope: scope === "all" ? "all" : "mine" });
  } catch (error) {
    return apiError(error);
  }
}
