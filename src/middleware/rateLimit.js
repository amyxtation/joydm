/**
 * In-memory fixed-window rate limiter (PRD §64). Keyed by client IP for login
 * attempts; deliberately tiny and dependency-free.
 */
export function createRateLimiter({ attempts, windowMs }) {
  const buckets = new Map();

  function bucket(key) {
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    return entry;
  }

  // Opportunistic cleanup so the map cannot grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key);
  }, windowMs).unref();

  return {
    /** Returns remaining attempts, or 0 when the caller is blocked. */
    remaining(key) {
      const entry = bucket(key);
      return Math.max(0, attempts - entry.count);
    },
    isBlocked(key) {
      return bucket(key).count >= attempts;
    },
    retryAfterMs(key) {
      const entry = bucket(key);
      return Math.max(0, entry.resetAt - Date.now());
    },
    recordFailure(key) {
      bucket(key).count += 1;
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}
