import { FoodProviderError, type FoodProviderErrorKind, type FoodProviderId } from './providers/types'

function errorName(error: unknown): string | null {
  // Duck-typed: DOMException/Error classes differ between realms (browser, Node, jsdom).
  if (typeof error !== 'object' || error === null || !('name' in error)) return null
  return typeof error.name === 'string' ? error.name : null
}

/** True for errors produced by aborting a request (fetch, AbortSignal, our own abort reasons). */
export function isAbortError(error: unknown): boolean {
  return errorName(error) === 'AbortError'
}

function isTimeoutError(error: unknown): boolean {
  return errorName(error) === 'TimeoutError'
}

/** Abort reason used when a provider exceeds its time budget (same name as AbortSignal.timeout()). */
export function createTimeoutReason(): DOMException {
  return new DOMException('The food data request took too long', 'TimeoutError')
}

/** 'timeout' when the signal was aborted by a time budget, otherwise 'aborted'. */
export function abortKind(signal: AbortSignal): Extract<FoodProviderErrorKind, 'timeout' | 'aborted'> {
  return isTimeoutError(signal.reason) ? 'timeout' : 'aborted'
}

export function abortedError(providerId: FoodProviderId, signal: AbortSignal): FoodProviderError {
  const kind = abortKind(signal)
  return new FoodProviderError(providerId, kind, kind === 'timeout' ? 'Request timed out' : 'Request was cancelled')
}

/**
 * Normalizes anything thrown by a provider call into a FoodProviderError.
 * `fallback` is used for unknown failures (e.g. 'network' around fetch).
 */
export function toProviderError(
  providerId: FoodProviderId,
  error: unknown,
  signal: AbortSignal | undefined,
  fallback: FoodProviderErrorKind = 'unavailable',
): FoodProviderError {
  if (error instanceof FoodProviderError) return error
  if (signal?.aborted) return abortedError(providerId, signal)
  if (isTimeoutError(error)) return new FoodProviderError(providerId, 'timeout', 'Request timed out')
  if (isAbortError(error)) return new FoodProviderError(providerId, 'aborted', 'Request was cancelled')
  const message = error instanceof Error ? error.message : 'Food data request failed'
  return new FoodProviderError(providerId, fallback, message)
}

/** Parses an HTTP Retry-After header (delta-seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, nowMs: number): number | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const date = Date.parse(trimmed)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - nowMs)
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason
}
