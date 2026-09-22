/**
 * Minimal in-memory, IP+route-keyed rate limiter.
 *
 * SCOPE NOTE: this is a single-instance, in-process limiter — a plain
 * `Map` that lives in server memory. It works correctly for one running
 * server process, but each instance has its own independent counters, so
 * it does NOT enforce a shared limit across multiple instances/regions
 * (e.g. several Vercel serverless/edge regions, or several containers
 * behind a load balancer). If this app is deployed to more than one
 * instance, replace this with a shared store (Upstash Redis, Vercel KV,
 * or a platform-level rate limiter) before relying on it. An in-memory
 * limiter was chosen here because this codebase has no existing dependency
 * on any shared cache/store, and adding one is a bigger, separate
 * infrastructure decision to make deliberately, not as a side effect of
 * adding rate limiting.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so this Map doesn't grow unbounded on
// a long-lived server process.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();
function sweepIfDue(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Checks and increments a fixed-window counter for `key`. Call once per
 * attempt; every call counts, including ones that are ultimately denied.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepIfDue(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP from standard proxy headers (Vercel and most reverse proxies set these). Falls back to a constant so at least a global limit still applies if nothing is set. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
