import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { studentSchema } from "@/lib/validations/student";
import { studentRepository } from "@/lib/repositories/studentRepository";

/** GET /api/students/:id — any authenticated user. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUserApi();
    const { id } = await params;
    const supabase = await createClient();
    const student = await studentRepository.getById(supabase, id);
    return NextResponse.json({ student });
  } catch (error) {
    return apiError(error);
  }
}

/** PATCH /api/students/:id — admin only, partial update. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = studentSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const student = await studentRepository.update(supabase, id, parsed.data);
    return NextResponse.json({ student });
  } catch (error) {
    return apiError(error);
  }
}

/** DELETE /api/students/:id — admin only, soft delete (is_active = false). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    await studentRepository.softDelete(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
