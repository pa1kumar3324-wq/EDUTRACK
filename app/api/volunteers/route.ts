import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { getSiteUrl } from "@/lib/utils/getSiteUrl";

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
 * SUPABASE_SERVICE_ROLE_KEY env var to call the admin invite API, and
 * NEXT_PUBLIC_SITE_URL (in any environment running on Vercel) so the
 * invite email links back to the real app instead of guessing at a host —
 * see lib/utils/getSiteUrl.ts.
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

  // Land the invitee on /set-password (via the auth callback, which exchanges
  // the invite code for a session) instead of straight into the dashboard —
  // inviteUserByEmail never sets a password, so without this they'd have no
  // way to sign back in once that first session expires.
  //
  // IMPORTANT: this must be built from the app's explicit, trusted canonical
  // URL — never from this request's own origin. See lib/utils/getSiteUrl.ts
  // for why (in short: request.url reflects whatever host this particular
  // request happened to arrive on, e.g. an admin's localhost dev server
  // pointed at production Supabase, which is exactly how invite emails were
  // ending up with http://localhost:3000 links in production).
  let siteUrl: string;
  try {
    siteUrl = getSiteUrl();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  const redirectTo = `${siteUrl}/api/auth/callback?next=${encodeURIComponent("/set-password")}`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("volunteers").update({ phone: phone || null, role: role ?? "volunteer" }).eq("id", data.user.id);

  return NextResponse.json({ volunteer: data.user }, { status: 201 });
}
