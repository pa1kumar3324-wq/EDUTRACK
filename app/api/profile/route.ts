import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { volunteerProfileSchema } from "@/lib/validations/volunteerProfile";

/**
 * PATCH /api/profile — updates the CALLER's own volunteer profile fields
 * (preferred_name, bio, teaching_interests, fun_fact, date_of_birth,
 * avatar_url). Never touches name/email/role/is_active — those stay
 * admin-only via /api/volunteers/:id. The RLS policy "volunteers_self_update"
 * plus the privilege-escalation trigger (supabase/migrations/005_*) already
 * enforce this at the database layer regardless of what this route does;
 * this schema is the app-layer half of that same boundary.
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUserApi();
    const supabase = await createClient();
    const body = await request.json();

    const parsed = volunteerProfileSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const volunteer = await volunteerRepository.update(supabase, user.id, parsed.data);
    return NextResponse.json({ volunteer });
  } catch (error) {
    return apiError(error);
  }
}
