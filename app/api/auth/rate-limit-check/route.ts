import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * POST /api/auth/rate-limit-check
 *
 * Both /login and /forgot-password call `supabase.auth.*` directly from
 * the browser (see the comments on those pages for why — no service-role
 * key needed, nothing for our server to add). That means our own
 * middleware/API routes never see those requests at all, so they can't be
 * rate-limited there. This endpoint is a small pre-flight our server DOES
 * see: the page calls it first and only proceeds to the real Supabase call
 * if it comes back 200. It doesn't perform any auth itself — it's purely a
 * per-IP attempt counter, so a login attempt can never be identity-limited
 * to a false negative from a shared cause of failed login attempts, e.g.,
 * "5 wrong passwords locks the account" (which would let an attacker lock
 * a real user out); this only ever throttles a source IP.
 *
 * Not a substitute for Supabase's own server-side auth rate limiting
 * (which still applies regardless) — this adds an additional layer that
 * blunts a fast scripted loop before it ever reaches Supabase.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "forgot-password" ? "forgot-password" : "login";

  // Deliberately generous — this exists to stop a fast automated loop, not
  // to interfere with a person mistyping their password a few times.
  const { allowed, retryAfterSeconds } = checkRateLimit(
    `auth:${action}:${getClientIp(request)}`,
    10,
    60_000
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  return NextResponse.json({ ok: true });
}
