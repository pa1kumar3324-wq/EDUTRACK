import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/types";

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

  return {
    id: profile.id,
    name: profile.name,
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
