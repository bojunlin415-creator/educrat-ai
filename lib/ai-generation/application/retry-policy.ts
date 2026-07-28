import {
  createRetryDecision,
  type RetryDecision,
  type RetryReason,
} from "@/lib/ai-generation/domain/retry";

const RETRYABLE_REASONS: readonly RetryReason[] = [
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_TIMEOUT",
  "PROVIDER_TRANSIENT_ERROR",
  "STRUCTURED_OUTPUT_REPAIRABLE",
];

export function decideRetry(input: {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly reason: RetryReason;
}): RetryDecision {
  if (
    input.attempt < input.maxAttempts &&
    RETRYABLE_REASONS.includes(input.reason)
  ) {
    return createRetryDecision({
      allowed: true,
      maxAttempts: input.maxAttempts,
      reason: input.reason,
    });
  }
  return createRetryDecision({
    allowed: false,
    maxAttempts: input.maxAttempts,
    reason: "NON_RETRYABLE",
  });
}
