/**
 * Client-side token bucket. Requests beyond the budget are rejected immediately (never queued), so the UI
 * can tell the user when to try again instead of silently hammering an API that bans abusive IPs.
 */
export type AcquireResult = { ok: true } | { ok: false; retryAfterMs: number }

export interface RateLimiter {
  tryAcquire(): AcquireResult
  /** Blocks all requests for `ms` (e.g. after the server answered 429 with Retry-After). */
  blockFor(ms: number): void
}

export interface TokenBucketOptions {
  /** Maximum burst size. */
  capacity: number
  /** One token is added every `refillIntervalMs`. */
  refillIntervalMs: number
  now?: () => number
}

export function createTokenBucket(options: TokenBucketOptions): RateLimiter {
  const now = options.now ?? Date.now
  const capacity = Math.max(1, options.capacity)
  const interval = Math.max(1, options.refillIntervalMs)
  let tokens = capacity
  let lastRefill = now()
  let blockedUntil = 0

  function refill(at: number): void {
    const elapsed = Math.max(0, at - lastRefill)
    tokens = Math.min(capacity, tokens + elapsed / interval)
    lastRefill = at
  }

  return {
    tryAcquire(): AcquireResult {
      const at = now()
      refill(at)
      if (at < blockedUntil) return { ok: false, retryAfterMs: blockedUntil - at }
      if (tokens >= 1) {
        tokens -= 1
        return { ok: true }
      }
      return { ok: false, retryAfterMs: Math.ceil((1 - tokens) * interval) }
    },
    blockFor(ms: number): void {
      const at = now()
      refill(at)
      blockedUntil = Math.max(blockedUntil, at + Math.max(0, ms))
      tokens = 0
    },
  }
}
