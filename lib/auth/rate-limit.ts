import "server-only";

import { createHash } from "node:crypto";
import {
  MemoryRateLimiter,
  type RateLimiter,
  type RateLimitResult,
  type RateLimitRule,
} from "@/lib/auth/rate-limiter";

export const authRateLimiter: RateLimiter = new MemoryRateLimiter();

const rules = {
  login: { limit: 5, windowMs: 15 * 60_000 },
  signup: { limit: 3, windowMs: 60 * 60_000 },
  forgotPassword: { limit: 3, windowMs: 60 * 60_000 },
  resetPassword: { limit: 5, windowMs: 60 * 60_000 },
  oauth: { limit: 10, windowMs: 15 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export type AuthRateLimitAction = keyof typeof rules;

export function checkAuthRateLimit(
  request: Request,
  action: AuthRateLimitAction,
): RateLimitResult {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded?.slice(0, 128) || "unknown";
  const key = createHash("sha256").update(`${action}:${address}`).digest("hex");

  return authRateLimiter.check(key, rules[action]);
}
