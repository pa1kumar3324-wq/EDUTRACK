import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { assignmentRepository } from "@/lib/repositories/assignmentRepository";

/** GET /api/assignments?studentId= */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId is required" }, { status: 400 });

  try {
    const assignments = await assignmentRepository.listForStudent(supabase, studentId);
    return NextResponse.json({ assignments });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** POST /api/assignments — admin only. Body: { studentId, volunteerId } */
export async function POST(request: Request) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { studentId, volunteerId } = await request.json();

  if (!studentId || !volunteerId) {
    return NextResponse.json({ error: "studentId and volunteerId are required" }, { status: 400 });
  }

  try {
    const assignment = await assignmentRepository.assign(supabase, studentId, volunteerId, user.id);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** DELETE /api/assignments — admin only. Body: { studentId, volunteerId } */
export async function DELETE(request: Request) {
  await requireAdmin();
  const supabase = await createClient();
  const { studentId, volunteerId } = await request.json();

  try {
    await assignmentRepository.unassign(supabase, studentId, volunteerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
