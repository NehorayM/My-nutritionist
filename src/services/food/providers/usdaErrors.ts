import { abortedError, parseRetryAfter, toProviderError } from '../providerErrors'
import { usdaErrorBodySchema } from '../normalize/usdaSchema'
import { FoodProviderError } from './types'

/**
 * Maps errors returned by `supabase.functions.invoke('food-search')` (docs/contracts/food-search-function.md).
 * supabase-js reports a non-2xx answer as `FunctionsHttpError` whose `context` is the Response, gateway
 * problems as `FunctionsRelayError` and network failures as `FunctionsFetchError`. Errors are duck-typed by
 * `name` so the mapping does not depend on one copy of supabase-js (or on realms in tests).
 */

/** Wait assumed after a 429 without a readable Retry-After (upstream blocks the key for one hour). */
export const USDA_DEFAULT_RETRY_MS = 3_600_000

export type UsdaErrorOutcome = { kind: 'not_found' } | { kind: 'error'; error: FoodProviderError }

interface ResponseLike {
  status: number
  headers: { get(name: string): string | null }
  json?: () => Promise<unknown>
}

function hasMethod(value: object, key: string): boolean {
  return key in value && typeof (value as Record<string, unknown>)[key] === 'function'
}

function asResponseLike(value: unknown): ResponseLike | null {
  if (typeof value !== 'object' || value === null) return null
  if (!('status' in value) || typeof value.status !== 'number') return null
  if (!('headers' in value) || typeof value.headers !== 'object' || value.headers === null) return null
  if (!hasMethod(value.headers, 'get')) return null
  return value as ResponseLike
}

function errorField(error: unknown, key: 'name' | 'context'): unknown {
  return typeof error === 'object' && error !== null && key in error ? (error as Record<string, unknown>)[key] : undefined
}

/** The `error.code` of the function's JSON error body, when readable. */
async function errorCode(response: ResponseLike): Promise<string | null> {
  if (typeof response.json !== 'function') return null
  try {
    const parsed = usdaErrorBodySchema.safeParse(await response.json())
    return parsed.success ? parsed.data.error.code : null
  } catch {
    return null
  }
}

const usdaError = (kind: FoodProviderError['kind'], message: string, retryAfterMs: number | null = null) => ({
  kind: 'error' as const,
  error: new FoodProviderError('usda', kind, message, retryAfterMs),
})

async function mapHttpError(response: ResponseLike, action: 'search' | 'food', nowMs: number): Promise<UsdaErrorOutcome> {
  const { status } = response
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'), nowMs) ?? USDA_DEFAULT_RETRY_MS
    return usdaError('rate_limited', 'USDA search limit reached', retryAfterMs)
  }
  if (status === 404) {
    // A missing food is a normal answer; a 404 on search means the function is not deployed.
    if (action === 'food' && (await errorCode(response)) === 'not_found') return { kind: 'not_found' }
    return usdaError('unavailable', 'USDA search is not available')
  }
  if (status === 504) return usdaError('timeout', 'USDA took too long to answer')
  if (status === 401 || status === 403 || status >= 500) {
    return usdaError('unavailable', `USDA search is not available (HTTP ${status})`)
  }
  return usdaError('http', `USDA search answered HTTP ${status}`)
}

/** Classifies an invoke error. `signal` decides between aborted/timeout when the call was cancelled. */
export async function classifyUsdaError(
  error: unknown,
  action: 'search' | 'food',
  signal: AbortSignal | undefined,
  nowMs: number,
): Promise<UsdaErrorOutcome> {
  if (signal?.aborted) return { kind: 'error', error: abortedError('usda', signal) }
  const name = errorField(error, 'name')
  if (name === 'FunctionsHttpError') {
    const response = asResponseLike(errorField(error, 'context'))
    if (response !== null) return mapHttpError(response, action, nowMs)
    return usdaError('unavailable', 'USDA search is not available')
  }
  if (name === 'FunctionsRelayError') return usdaError('unavailable', 'USDA search is not available right now')
  if (name === 'FunctionsFetchError') {
    // The wrapped fetch error tells aborts/timeouts apart from network failures.
    return { kind: 'error', error: toProviderError('usda', errorField(error, 'context'), signal, 'network') }
  }
  // supabase-js returns body parsing failures (e.g. malformed JSON) as plain errors.
  if (name === 'SyntaxError') return usdaError('invalid_response', 'USDA search returned malformed data')
  return { kind: 'error', error: toProviderError('usda', error, signal, 'unavailable') }
}
