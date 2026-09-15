import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { roadmapEntrySchema } from "@/lib/validations/roadmap";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";

/** PATCH /api/roadmap/:id — admin only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = roadmapEntrySchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const entry = await roadmapRepository.update(supabase, id, parsed.data);
    return NextResponse.json({ entry });
  } catch (error) {
    return apiError(error);
  }
}

/** DELETE /api/roadmap/:id — admin only. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    await roadmapRepository.remove(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
