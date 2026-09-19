/**
 * Lazily creates a Supabase client authenticated with the service-role key
 * — bypasses RLS and can call the Auth Admin API. Same dynamic-import
 * pattern POST /api/volunteers uses (keeps @supabase/supabase-js's admin
 * surface, which must never reach the browser bundle, out of any shared
 * top-level import).
 *
 * Returns null if SUPABASE_SERVICE_ROLE_KEY isn't configured, so callers
 * can degrade gracefully (e.g. a deactivation should still succeed even if
 * the session-revocation step that depends on this can't run) instead of
 * throwing.
 */
export async function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}
