import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { roadmapEntrySchema } from "@/lib/validations/roadmap";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";

/** GET /api/roadmap?grade= — all grades if omitted. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get("grade");

  try {
    const entries = grade
      ? await roadmapRepository.listByGrade(supabase, Number(grade))
      : await roadmapRepository.listAll(supabase);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** POST /api/roadmap — admin only. Creates one ordered topic. */
export async function POST(request: Request) {
  await requireAdmin();
  const supabase = await createClient();
  const body = await request.json();

  const parsed = roadmapEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const entry = await roadmapRepository.create(supabase, parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
