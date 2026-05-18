/**
 * Rate limiter with LRU in-memory store.
 *
 * WARNING: In-memory rate limiting does NOT work across multiple
 * server instances. For production multi-instance deployments,
 * set REDIS_URL and use a Redis-backed rate limiter (e.g. upstash-ratelimit).
 *
 * The LRU store prevents unbounded memory growth and auto-expires entries.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_STORE_SIZE = 10_000;
const store = new Map<string, RateLimitEntry>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

// Clean up expired entries every 60 seconds
setInterval(cleanupExpired, 60_000);

function touch(key: string, entry: RateLimitEntry) {
  // LRU: delete + re-set moves key to end (most recently used)
  store.delete(key);
  store.set(key, entry);
}

/**
 * Check rate limit for a given key (usually IP address).
 * @returns `true` if allowed, `false` if rate limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  cleanupExpired();

  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    if (store.size >= MAX_STORE_SIZE) {
      // Evict oldest entry (first in map)
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) store.delete(firstKey);
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count += 1;
  touch(key, entry);
  return true;
}

/**
 * Extract client IP from request headers (works behind Vercel / nginx).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Enforce a maximum JSON body size to prevent memory exhaustion attacks.
 * Call this before `req.json()` on public API routes.
 * @throws Error if Content-Length header exceeds limit.
 */
export function enforceBodySize(req: Request, maxBytes = 1024 * 1024): void {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw new Error("Payload too large.");
  }
}
