import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { assignmentSchema } from "@/lib/validations/assignment";
import { assignmentRepository } from "@/lib/repositories/assignmentRepository";

/** GET /api/assignments?studentId= — any authenticated user. */
export async function GET(request: Request) {
  try {
    await requireUserApi();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId is required" }, { status: 400 });

    const assignments = await assignmentRepository.listForStudent(supabase, studentId);
    return NextResponse.json({ assignments });
  } catch (error) {
    return apiError(error);
  }
}

/** POST /api/assignments — admin only. Body: { studentId, volunteerId } */
export async function POST(request: Request) {
  try {
    const user = await requireAdminApi();
    const supabase = await createClient();
    const body = await request.json();

    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const assignment = await assignmentRepository.assign(supabase, parsed.data.studentId, parsed.data.volunteerId, user.id);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

/** DELETE /api/assignments — admin only. Body: { studentId, volunteerId } */
export async function DELETE(request: Request) {
  try {
    await requireAdminApi();
    const supabase = await createClient();
    const body = await request.json();

    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    await assignmentRepository.unassign(supabase, parsed.data.studentId, parsed.data.volunteerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
