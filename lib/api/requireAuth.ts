import { createClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/types";
import { displayName } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";

/**
 * API-route equivalents of lib/auth.ts's requireUser()/requireAdmin().
 *
 * WHY THIS FILE EXISTS: `redirect()` (from next/navigation), which
 * requireUser()/requireAdmin() use, is designed for Server Components and
 * Server Actions — calling it throws a special NEXT_REDIRECT signal that
 * Next.js's rendering pipeline converts into a 307 redirect response. Route
 * Handlers (app/api/**\/route.ts) are plain HTTP endpoints, not part of that
 * rendering pipeline that many API consumers (fetch() calls, the mobile
 * app, curl, a future integration) expect to receive a JSON body with a
 * standard status code from — not a redirect.
 *
 * Before this fix, every API route that called requireUser()/requireAdmin()
 * directly would silently respond with `307 -> /login` (or `/dashboard` for
 * a non-admin hitting an admin-only route) instead of `401 Unauthorized` /
 * `403 Forbidden`. A browser `fetch()` follows redirects by default, so the
 * caller would receive the *login page's HTML* where it expected JSON —
 * `res.json()` then throws a confusing "Unexpected token '<'" SyntaxError
 * instead of a clean, catchable auth error. This is exactly the class of
 * bug the task's "return appropriate standard HTTP status codes" requirement
 * targets.
 *
 * These two functions never call redirect(). They throw ApiError, which
 * every route handler converts to a correct 401/403 JSON response via
 * apiError() (see lib/api/errors.ts). Server Components/layouts should
 * keep using lib/auth.ts's requireUser()/requireAdmin() — redirecting is
 * exactly the right behavior there.
 */
export async function requireUserApi(): Promise<AuthUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new ApiError(401, "Not authenticated");

  const { data: profile, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) throw new ApiError(401, "Not authenticated");

  // A deactivated profile IS authenticated (they have a valid session) —
  // 401 would be wrong here and would look identical to "not logged in" to
  // a caller. 403 lets the client tell the two apart.
  if (!profile.is_active) throw new ApiError(403, "Your account has been deactivated.");

  return {
    id: profile.id,
    name: profile.name,
    preferredName: profile.preferred_name,
    displayName: displayName(profile),
    email: profile.email,
    role: profile.role,
    avatarUrl: profile.avatar_url,
  };
}

/** Like requireUserApi, but throws a 403 ApiError for non-admins instead of redirecting. */
export async function requireAdminApi(): Promise<AuthUser> {
  const user = await requireUserApi();
  if (user.role !== "admin") throw new ApiError(403, "Admins only");
  return user;
}
