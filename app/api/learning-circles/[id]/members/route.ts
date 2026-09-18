import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { circleMembersSchema } from "@/lib/validations/learningCircle";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";

/**
 * PUT /api/learning-circles/[id]/members — admin only.
 * Body: { volunteer_ids: string[] } — the FULL desired roster.
 *
 * Declarative rather than add/remove deltas: the client sends the roster it
 * wants and the server diffs it. AssignVolunteersDialog's add/remove
 * approach needs Promise.allSettled and per-item error reporting precisely
 * because a partial failure leaves the UI and the database disagreeing;
 * one request that either applies or doesn't avoids that class of bug
 * entirely here.
 *
 * Returns 409 if any volunteer already belongs to a different circle — a
 * volunteer is in at most one circle so that every debrief has exactly one
 * unambiguous verifier.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = circleMembersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    // 404s via the repository if the circle doesn't exist, before we write.
    await learningCircleRepository.getById(supabase, id);

    const result = await learningCircleRepository.setMembers(
      supabase,
      id,
      parsed.data.volunteer_ids,
      user.id
    );
    const circle = await learningCircleRepository.getById(supabase, id);

    return NextResponse.json({ circle, ...result });
  } catch (error) {
    return apiError(error);
  }
}
