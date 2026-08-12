import { NextResponse } from "next/server";
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
 * GET /api/auth/callback?code=...&next=...
 * Exchanges the Supabase auth code (from a magic-link email) for a session
 * cookie, then redirects into the app. Used as the `emailRedirectTo` /
 * invite redirect target.
 *
 * `next` is restricted to a small allow-list of known-safe internal paths
 * (see ALLOWED_NEXT_PATHS) — it is never used to build an external or
 * protocol-relative redirect.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
