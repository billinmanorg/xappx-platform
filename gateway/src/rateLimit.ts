/**
 * Fixed-window rate limiting, in memory. Keyed per brand and route class so one
 * brand's traffic cannot exhaust another's budget.
 *
 * In-memory is correct for a single instance; a multi-instance deployment moves
 * this to a shared store (Redis). The limiter interface stays the same, so that
 * is a swap, not a rewrite.
 */
export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number): RateResult {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, b);
    }
    b.count++;
    return {
      allowed: b.count <= limit,
      remaining: Math.max(0, limit - b.count),
      resetAt: b.resetAt,
    };
  }
}
