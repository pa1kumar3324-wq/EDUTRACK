import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { learningCircleSchema } from "@/lib/validations/learningCircle";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";

/**
 * GET /api/learning-circles
 *
 * Any authenticated user. A volunteer legitimately needs to know which
 * circle they're in and who leads it (that's who will verify their
 * debriefs), the same way assignments are readable by everyone so
 * volunteers can see who else is on a case. Only the public volunteer
 * projection is joined in — no phone/date_of_birth.
 *
 * `?mine=1` narrows to the caller's own circle.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUserApi();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("mine")) {
      const circle = await learningCircleRepository.forVolunteer(supabase, user.id);
      return NextResponse.json({ circle });
    }

    const circles = await learningCircleRepository.list(supabase);
    return NextResponse.json({ circles });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/learning-circles — admin only.
 * Body: { name, description?, lead_admin_id, member_ids? }
 *
 * `member_ids` is optional: a circle can be created empty and filled in
 * afterwards via PUT /api/learning-circles/[id]/members.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAdminApi();
    const supabase = await createClient();
    const body = await request.json();

    const parsed = learningCircleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const circle = await learningCircleRepository.create(supabase, parsed.data, user.id);
    return NextResponse.json({ circle }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
