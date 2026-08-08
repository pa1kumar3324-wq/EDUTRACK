import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { attendanceSchema, bulkAttendanceSchema } from "@/lib/validations/attendance";
import { attendanceRepository } from "@/lib/repositories/attendanceRepository";

/**
 * GET /api/attendance?date=YYYY-MM-DD              — admin only, one session date, all volunteers
 * GET /api/attendance?volunteerId=&from=&to=        — self or admin, one volunteer's history
 * GET /api/attendance?from=&to=                     — admin only, everyone (used by export)
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const volunteerId = searchParams.get("volunteerId");
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    if (date) {
      if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
      const records = await attendanceRepository.listForDate(supabase, date);
      return NextResponse.json({ records });
    }

    if (volunteerId) {
      if (user.role !== "admin" && user.id !== volunteerId) {
        return NextResponse.json({ error: "You can only view your own attendance" }, { status: 403 });
      }
      const records = await attendanceRepository.listForVolunteer(supabase, volunteerId);
      return NextResponse.json({ records });
    }

    if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
    const records = await attendanceRepository.listAll(supabase, { from, to });
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/attendance — admin only. Marks one volunteer (attendanceSchema)
 * or several at once (bulkAttendanceSchema, when `volunteer_ids` is present).
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const body = await request.json();

  try {
    if (Array.isArray(body.volunteer_ids)) {
      const parsed = bulkAttendanceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      const records = await attendanceRepository.markBulk(supabase, parsed.data, admin.id);
      return NextResponse.json({ records }, { status: 201 });
    }

    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const record = await attendanceRepository.mark(supabase, parsed.data, admin.id);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
