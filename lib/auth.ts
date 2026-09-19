import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/types";
import { displayName } from "@/lib/utils";

/**
 * Resolves the current authenticated user's profile row (role, name, etc).
 * Redirects to /login if there is no session. Use in Server Components /
 * layouts that require auth — pages under (dashboard) all call this.
 */
export async function requireUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login");

  // Deactivating a volunteer only flips `is_active` — it doesn't end their
  // session, so a still-valid cookie would otherwise sail straight through
  // this check every time. Sign them out here (not just redirect) so the
  // middleware sees no session on the next request: without the signOut,
  // the middleware would see a valid session and let them through to the
  // layout, which redirects here, which redirects back — a loop.
  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?reason=deactivated");
  }

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

/** Like requireUser, but redirects non-admins to their dashboard instead. */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
