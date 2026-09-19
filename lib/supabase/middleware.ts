import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

const PUBLIC_PATHS = ["/login", "/forgot-password"];

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. Wired up in proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Deactivating a volunteer only flips `is_active` in the DB — it doesn't
  // end whatever session they already hold, so without this check a
  // deactivated volunteer with a still-valid cookie sails straight through.
  // This runs on every request, so keep it to the one boolean we need —
  // do not widen this into a full profile fetch.
  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from("volunteers")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "deactivated");
      const redirectResponse = NextResponse.redirect(url);
      // signOut() above clears the auth cookies via this client's setAll,
      // which lands them on `response` (reassigned by setAll, see above) —
      // but `response` isn't what we're returning here, so those cleared
      // cookies need to be copied onto the redirect we actually send back.
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
      return redirectResponse;
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
