// Fixed-window in-memory rate limiter.
// Best-effort only: state is per server instance and resets on cold start.
// For multi-instance deployments, swap this for a shared store (e.g. Upstash Redis).

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();

    // Opportunistic cleanup so the map doesn't grow unbounded
    if (buckets.size > 10_000) {
        for (const [k, b] of buckets) {
            if (b.resetAt <= now) buckets.delete(k);
        }
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSec: 0 };
    }

    if (bucket.count >= limit) {
        return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
    }

    bucket.count += 1;
    return { allowed: true, retryAfterSec: 0 };
}
