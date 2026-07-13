import { MemoryRateLimiter } from "./rate-limiter";

describe("MemoryRateLimiter", () => {
  it("blocks requests over the configured limit", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    const rule = { limit: 2, windowMs: 10_000 };

    expect(limiter.check("login:key", rule).allowed).toBe(true);
    expect(limiter.check("login:key", rule).allowed).toBe(true);
    expect(limiter.check("login:key", rule)).toEqual({
      allowed: false,
      retryAfterSeconds: 10,
    });

    now = 11_000;
    expect(limiter.check("login:key", rule).allowed).toBe(true);
  });

  it("keeps different keys isolated", () => {
    const limiter = new MemoryRateLimiter(() => 0);
    const rule = { limit: 1, windowMs: 1_000 };

    expect(limiter.check("first", rule).allowed).toBe(true);
    expect(limiter.check("first", rule).allowed).toBe(false);
    expect(limiter.check("second", rule).allowed).toBe(true);
  });
});
