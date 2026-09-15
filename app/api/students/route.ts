import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { studentSchema } from "@/lib/validations/student";
import { studentRepository } from "@/lib/repositories/studentRepository";

/** GET /api/students?search=&grade=&englishLevel=&mathLevel=&volunteerId= — any authenticated user. */
export async function GET(request: Request) {
  try {
    await requireUserApi();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get("search") ?? undefined,
      grade: searchParams.get("grade") ? Number(searchParams.get("grade")) : undefined,
      englishLevel: searchParams.get("englishLevel") ?? undefined,
      mathLevel: searchParams.get("mathLevel") ?? undefined,
      volunteerId: searchParams.get("volunteerId") ?? undefined,
    };

    const students = await studentRepository.list(supabase, filters);
    return NextResponse.json({ students });
  } catch (error) {
    return apiError(error);
  }
}

/** POST /api/students — admin only. */
export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const supabase = await createClient();
    const body = await request.json();

    const parsed = studentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const student = await studentRepository.create(supabase, parsed.data);
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
