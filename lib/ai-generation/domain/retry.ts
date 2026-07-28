export const RETRY_REASONS = [
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_TIMEOUT",
  "PROVIDER_TRANSIENT_ERROR",
  "STRUCTURED_OUTPUT_REPAIRABLE",
  "NON_RETRYABLE",
] as const;

export type RetryReason = (typeof RETRY_REASONS)[number];

export interface RetryDecision {
  readonly allowed: boolean;
  readonly maxAttempts: number;
  readonly reason: RetryReason;
}

export interface RetryPolicy {
  readonly decide: (input: {
    readonly attempt: number;
    readonly reason: RetryReason;
  }) => RetryDecision;
}

export function createRetryDecision(input: RetryDecision): RetryDecision {
  return Object.freeze({ ...input });
}
