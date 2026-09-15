import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { volunteerSchema } from "@/lib/validations/roadmap";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";

/** PATCH /api/volunteers/:id — admin only, e.g. change role or phone. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = volunteerSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const volunteer = await volunteerRepository.update(supabase, id, parsed.data);
    return NextResponse.json({ volunteer });
  } catch (error) {
    return apiError(error);
  }
}

/** DELETE /api/volunteers/:id — admin only, deactivates (does not hard-delete, preserves history). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    await volunteerRepository.deactivate(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
