/**
 * Resolves the canonical, trusted base URL for building absolute links used
 * in Supabase auth emails (volunteer invites, password resets, etc).
 *
 * We deliberately do NOT derive this from the incoming request's Host
 * header / `new URL(request.url).origin`. That value is not a reliable
 * signal of "where should this permanent email link point": it reflects
 * whatever host the request happened to arrive on (e.g. an admin testing
 * against production Supabase from `localhost:3000`, or an unexpected host
 * behind a proxy), not the app's real public URL. An auth email link is a
 * secret-bearing link (it signs the recipient in) sent to a third party, so
 * it must always point at a URL we explicitly trust — never one inferred
 * from client-controlled/ambiguous request data.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_SITE_URL` — the explicit, canonical site URL, if set.
 *      Must be a valid absolute http(s) URL (validated via the `URL`
 *      constructor, not trusted as an arbitrary string). On Vercel, it
 *      additionally may NOT point at localhost/loopback — see below.
 *   2. If not set and we're NOT running on Vercel (`VERCEL` env var unset),
 *      assume local development and fall back to `http://localhost:3000`.
 *   3. If not set and we ARE running on Vercel (Production or Preview),
 *      throw a clear configuration error instead of guessing. We
 *      intentionally do NOT fall back to Vercel's auto-generated
 *      `VERCEL_URL` here: on Production deployments it's the immutable
 *      per-deployment URL rather than your custom domain, and on Preview
 *      deployments it would silently start minting real invitation/reset
 *      links pointing at ephemeral preview URLs — neither is safe to send
 *      to a real user without the app owner explicitly opting in.
 *
 * On Vercel specifically, a *configured* `NEXT_PUBLIC_SITE_URL` is also
 * rejected if it points at localhost/loopback (127.0.0.1, 0.0.0.0) or uses
 * a non-http(s) scheme — those are only ever valid for local development,
 * and a Vercel deployment sending emails with such a link is always a
 * misconfiguration, not a legitimate use case.
 */

/** Hostnames that only ever make sense for local development. */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function getSiteUrl(): string {
  const isVercel = process.env.VERCEL === "1";
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (raw) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL is not a valid URL: "${raw}". It must be an absolute URL, e.g. ` +
          `https://your-app.vercel.app.`
      );
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL must use http or https (got "${parsed.protocol}"). ` +
          `Set it to your app's real URL, e.g. https://your-app.vercel.app.`
      );
    }

    if (isVercel && LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL is set to "${raw}", which is a localhost/loopback address. ` +
          "Vercel requires the real public production URL — set NEXT_PUBLIC_SITE_URL in " +
          "Vercel Project Settings → Environment Variables to your production URL " +
          "(e.g. https://your-app.vercel.app), then redeploy."
      );
    }

    // Strip any trailing slash(es) so callers can safely do `${getSiteUrl()}/path`.
    return raw.replace(/\/+$/, "");
  }

  if (!isVercel) {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_SITE_URL is not configured. Vercel requires the real public production URL — " +
      "set it in Vercel Project Settings → Environment Variables to your production URL " +
      "(e.g. https://your-app.vercel.app), then redeploy."
  );
}
