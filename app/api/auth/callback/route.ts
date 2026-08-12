import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Internal destinations the invite/auth email flow is allowed to send
 * someone to after exchanging their code for a session. `next` arrives as a
 * query param on a link we email out, so it's effectively user-controlled —
 * without this allow-list, `?next=https://evil.example` or `?next=//evil.example`
 * (a protocol-relative URL) would be an open redirect.
 */
const ALLOWED_NEXT_PATHS = new Set(["/set-password", "/dashboard", "/login"]);

function safeNextPath(next: string | null): string {
  if (next && ALLOWED_NEXT_PATHS.has(next)) return next;
  return "/dashboard";
}

/**
 * Email OTP types Supabase's `verifyOtp` accepts. We only ever expect
 * "invite" from this app's flows today, but "recovery"/"magiclink"/"email"
 * are accepted too so this route keeps working if those flows are added
 * later — an unrecognized `type` value is rejected below.
 */
const VALID_OTP_TYPES = new Set<EmailOtpType>([
  "invite",
  "signup",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * GET /api/auth/callback?...&next=...
 *
 * Supabase's email-link auth is NOT one single shape. Depending on the flow
 * that generated the link, the browser lands here with one of two different
 * query-param contracts:
 *
 *   1. PKCE / OAuth-style flows: `?code=...`
 *      → exchanged via `exchangeCodeForSession(code)`.
 *
 *   2. Email OTP verification flows — which is what
 *      `supabase.auth.admin.inviteUserByEmail()` actually produces —
 *      `?token_hash=...&type=invite` (also used for signup confirmation,
 *      magic links, recovery, etc, with a different `type`).
 *      → exchanged via `verifyOtp({ token_hash, type })`.
 *
 * The previous version of this route only handled case 1. A volunteer
 * invite link arrives as case 2, so `exchangeCodeForSession` was never
 * called with anything usable, no session/cookie was ever established, and
 * the user fell through to the `/login` redirect below — landing on the
 * password-login page despite never having set a password. This route now
 * handles both shapes so the invite flow actually authenticates the
 * browser before redirecting to `/set-password`.
 *
 * `next` is restricted to a small allow-list of known-safe internal paths
 * (see ALLOWED_NEXT_PATHS) — it is never used to build an external or
 * protocol-relative redirect.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && type && VALID_OTP_TYPES.has(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${error.message === "Token has expired or is invalid" ? "invite_expired" : "auth_callback_failed"}`
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
