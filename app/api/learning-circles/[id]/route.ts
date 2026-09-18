import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { learningCircleUpdateSchema } from "@/lib/validations/learningCircle";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";

/** GET /api/learning-circles/[id] — any authenticated user. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUserApi();
    const { id } = await params;
    const supabase = await createClient();
    const circle = await learningCircleRepository.getById(supabase, id);
    return NextResponse.json({ circle });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * PATCH /api/learning-circles/[id] — admin only.
 * Body: any of { name, description, lead_admin_id, is_active }
 *
 * Reassigning `lead_admin_id` immediately moves this circle's pending queue
 * to the new lead (the queue is derived from the circle, not snapshotted on
 * the debrief), which is exactly what you want when a lead goes on leave.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = learningCircleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const circle = await learningCircleRepository.update(supabase, id, parsed.data);
    return NextResponse.json({ circle });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * DELETE /api/learning-circles/[id] — admin only. Soft delete (is_active =
 * false), mirroring volunteer deactivation.
 *
 * Members of a deactivated circle fall back to the default flow: their next
 * debrief is recorded immediately, because volunteer_active_circle() only
 * matches active circles. Debriefs already pending stay pending and remain
 * verifiable by the (still-assigned) lead — deactivating a circle shouldn't
 * silently discard work that's mid-review.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    await learningCircleRepository.deactivate(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
