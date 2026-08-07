import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";

/** GET /api/volunteers */
export async function GET() {
  const supabase = await createClient();
  try {
    const volunteers = await volunteerRepository.list(supabase);
    return NextResponse.json({ volunteers });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/volunteers — admin only. Invites a volunteer via Supabase Auth
 * (magic link) and creates their `volunteers` profile row. Requires the
 * SUPABASE_SERVICE_ROLE_KEY env var to call the admin invite API.
 */
export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json();
  const { name, email, phone, role } = body as { name: string; email: string; phone?: string; role: "admin" | "volunteer" };

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured — cannot send invites. Add it to your environment." },
      { status: 501 }
    );
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("volunteers").update({ phone: phone || null, role: role ?? "volunteer" }).eq("id", data.user.id);

  return NextResponse.json({ volunteer: data.user }, { status: 201 });
}
