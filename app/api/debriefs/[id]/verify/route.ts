import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { debriefVerificationSchema } from "@/lib/validations/learningCircle";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";

/**
 * POST /api/debriefs/[id]/verify — the lead admin's decision.
 * Body: { action: "verify" | "reject", notes? }
 *
 * On "verify" the debrief is RECORDED: it becomes visible to
 * latest_progress, students_needing_revision, exports, and the roadmap
 * continuity engine, and `verified_by`/`verified_at` are stamped by the
 * database from auth.uid()/now() (not from this process, so the audit trail
 * reflects who Postgres actually saw).
 *
 * On "reject" the row is retained for audit but counted nowhere. Pair it
 * with a note — that's what makes the outcome actionable for the volunteer
 * who filed it.
 *
 * requireAdminApi() is a coarse first gate only. The real authorization —
 * "you must be the lead admin OF THIS CIRCLE" — lives in the
 * guard_debrief_verification() trigger, and surfaces here as a 403.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = debriefVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const debrief = await learningCircleRepository.setVerification(
      supabase,
      id,
      parsed.data.action,
      parsed.data.notes || undefined
    );

    return NextResponse.json({ debrief });
  } catch (error) {
    return apiError(error);
  }
}
