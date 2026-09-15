import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * A deliberate, expected API error carrying its own HTTP status code
 * (401/403/404/400/etc). Thrown by requireUserApi()/requireAdminApi() and
 * repositories/handlers that need to signal something more specific than a
 * generic 500. Always caught by apiError() at the top of every route
 * handler's catch block.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Converts any error thrown inside a route handler into the right
 * NextResponse. Route handlers should wrap their entire body in
 * try { ... } catch (error) { return apiError(error); } — including the
 * requireUserApi()/requireAdminApi() call — so an auth failure returns a
 * real 401/403 JSON body instead of an unhandled exception (which Next.js
 * would otherwise turn into an opaque 500) or, worse, a redirect (see
 * lib/api/requireAuth.ts for why that used to happen).
 *
 * Unexpected errors are logged server-side but never leak internal details
 * (stack traces, driver-specific messages) to the client beyond the
 * message text the codebase already surfaces intentionally (e.g.
 * repository "not found" errors) — those are treated as trusted,
 * human-readable strings written by this codebase, not raw driver output.
 */
export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  console.error("[api] unhandled error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
