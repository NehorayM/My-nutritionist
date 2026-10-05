/** Exponential retry delays for retryable sync failures: base, 2×base, 4×base … capped at `maxMs`. */
export interface BackoffPolicy {
  baseMs: number
  maxMs: number
}

/** 2 s → 4 s → 8 s … → 5 min. */
export const DEFAULT_BACKOFF: BackoffPolicy = { baseMs: 2_000, maxMs: 300_000 }

/**
 * Delay before retry number `attempt` (1 = first retry after the first failure).
 * Attempts below 1 are treated as 1; the result never exceeds `policy.maxMs`.
 */
export function backoffDelayMs(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF): number {
  const exponent = Math.max(0, Math.floor(attempt) - 1)
  // 2^30 × base already exceeds any sensible cap; clamping the exponent avoids Infinity.
  const delay = policy.baseMs * 2 ** Math.min(exponent, 30)
  return Math.min(policy.maxMs, delay)
}
