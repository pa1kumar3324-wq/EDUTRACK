import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi, requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { volunteerInviteSchema } from "@/lib/validations/roadmap";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { getSiteUrl } from "@/lib/utils/getSiteUrl";

/** GET /api/volunteers — any authenticated user. Returns the public
 * projection only (no phone/date_of_birth) — nothing in the UI currently
 * calls this with GET, but it's reachable directly, so it must not leak
 * PII to non-admin callers. Admin surfaces that need full rows (e.g. the
 * People > Volunteers table) fetch server-side via `volunteerRepository.list`
 * directly, gated by the admin layout — not through this route. */
export async function GET() {
  try {
    await requireUserApi();
    const supabase = await createClient();
    const volunteers = await volunteerRepository.listPublic(supabase);
    return NextResponse.json({ volunteers });
  } catch (error) {
    return apiError(error);
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
  try {
    await requireAdminApi();
    const body = await request.json();

    const parsed = volunteerInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { name, email, phone, role } = parsed.data;

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
  } catch (error) {
    return apiError(error);
  }
}
