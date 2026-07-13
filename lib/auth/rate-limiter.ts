export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule): RateLimitResult;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  check(key: string, rule: RateLimitRule): RateLimitResult {
    const currentTime = this.now();
    const existing = this.buckets.get(key);
    const bucket =
      !existing || existing.resetAt <= currentTime
        ? { count: 0, resetAt: currentTime + rule.windowMs }
        : existing;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    return {
      allowed: bucket.count <= rule.limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.resetAt - currentTime) / 1000),
      ),
    };
  }
}
