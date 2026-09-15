import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { attendanceRepository } from "@/lib/repositories/attendanceRepository";

/** DELETE /api/attendance/:id — admin only, e.g. undo a mis-marked entry. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    await attendanceRepository.remove(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
