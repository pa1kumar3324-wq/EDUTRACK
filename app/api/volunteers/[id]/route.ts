import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { getServiceClient } from "@/lib/api/serviceClient";
import { volunteerSchema } from "@/lib/validations/roadmap";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";

/**
 * Bans (or un-bans) a volunteer's Supabase Auth account so a deactivation
 * takes effect immediately, not just "eventually". This is the real
 * mechanism for killing an already-issued, not-yet-expired session:
 * `supabase.auth.admin.signOut()` only ends the session belonging to the
 * JWT you hand it (it can't be pointed at an arbitrary user id — GoTrue has
 * no "log this user out everywhere" admin endpoint), so it can't do this.
 * A ban can: GoTrue's own auth middleware rejects any request bearing a
 * banned user's access token outright, even one issued before the ban and
 * still cryptographically valid — so it takes effect on their very next
 * request rather than waiting for natural token expiry.
 *
 * There's no literal "forever" duration (only a relative one, or "none" to
 * clear it), so ~100 years stands in for permanent. Returns a warning
 * string on any failure (missing service key, or the Admin API call itself
 * failing) instead of throwing — the caller decides whether that should
 * block the response, but it should never roll back the `is_active` write
 * that already succeeded.
 */
async function syncLoginBan(id: string, banned: boolean): Promise<string | null> {
  const admin = await getServiceClient();
  if (!admin) {
    return banned
      ? "SUPABASE_SERVICE_ROLE_KEY is not configured — the volunteer's existing sessions were not revoked."
      : "SUPABASE_SERVICE_ROLE_KEY is not configured — couldn't confirm their login ban was lifted.";
  }
  try {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: banned ? "876000h" : "none",
    });
    if (error) throw error;
    return null;
  } catch (err) {
    console.error("[api] failed to sync volunteer login ban:", err);
    return banned
      ? "Deactivated, but revoking their active sessions failed. They may stay signed in until their session naturally expires."
      : "Reactivated, but couldn't lift their login ban — they may still be blocked from signing in.";
  }
}

/**
 * PATCH /api/volunteers/:id — admin only, e.g. change role/phone, or
 * reactivate a previously-deactivated volunteer via `{ is_active: true }`.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = volunteerSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const volunteer = await volunteerRepository.update(supabase, id, parsed.data);

    // Reactivating must undo the ban DELETE below applies on deactivation,
    // or a reactivated volunteer would still be locked out. Deactivating
    // through this route (rather than DELETE) gets the same ban applied,
    // so both paths lock out / restore access consistently.
    if (parsed.data.is_active !== undefined) {
      const warning = await syncLoginBan(id, !parsed.data.is_active);
      if (warning) return NextResponse.json({ volunteer, warning });
    }

    return NextResponse.json({ volunteer });
  } catch (error) {
    return apiError(error);
  }
}

/** DELETE /api/volunteers/:id — admin only, deactivates (does not hard-delete, preserves history). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    await volunteerRepository.deactivate(supabase, id);

    const warning = await syncLoginBan(id, true);
    if (warning) return NextResponse.json({ ok: true, warning });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
