// Basic in-memory, fixed-window rate limiter, deliberately not backed by
// Redis or any external store. This is sufficient for an MVP running as a
// single Node process (the same assumption the SQLite database already
// makes), but has two known limitations worth calling out explicitly:
//   1. Counters reset whenever the process restarts.
//   2. Counters are NOT shared across multiple server instances, if this
//      app is ever horizontally scaled, this needs to move to a shared
//      store (e.g. Redis) to remain effective.
// For a single-instance MVP deployment this is a reasonable, honest
// trade-off between "no protection at all" and "infra we don't need yet".

interface Bucket {
count: number;
windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitRule {
limit: number;
windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitRule> = {
createRanking: { limit: 10, windowMs: 24 * 60 * 60 * 1000 }, // 10 per day
claimProfile: { limit: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 per day
like: { limit: 30, windowMs: 60 * 1000 }, // 30 per minute
share: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
support: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute
nominate: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
};

// Returns true if the action is allowed (and records it), false if the
// caller has hit the limit for this key within the current window.
export function checkRateLimit(key: string, rule: RateLimitRule): boolean {
const now = Date.now();
const bucket = buckets.get(key);

if (!bucket || now - bucket.windowStart >= rule.windowMs) {
buckets.set(key, { count: 1, windowStart: now });
return true;
}

if (bucket.count >= rule.limit) {
return false;
}

bucket.count += 1;
return true;
}
