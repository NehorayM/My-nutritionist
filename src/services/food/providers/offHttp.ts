import { parseRetryAfter, toProviderError } from '../providerErrors'
import type { RateLimiter } from '../rateLimiter'
import { FoodProviderError } from './types'

/** Default Open Food Facts origin (CORS `*`, keyless). */
export const OFF_BASE_URL = 'https://world.openfoodfacts.org'
/**
 * OFF asks every client to identify itself ("AppName/Version (contact)"). Browsers cannot override
 * User-Agent, so the value goes in X-User-Agent, which OFF's CORS allow-list explicitly accepts.
 */
export const OFF_USER_AGENT = 'My-nutritionist/1.0 (https://github.com/my-nutritionist)'
/** Wait assumed after a 429 without Retry-After (OFF limits are per minute). */
export const OFF_DEFAULT_RETRY_MS = 60_000

export interface OffHttpContext {
  fetch: typeof fetch
  userAgent: string
  now: () => number
}

export type OffHttpResult = { status: 'not_found' } | { status: 'ok'; body: unknown }

/**
 * GET + JSON with OFF-specific error mapping:
 * client limiter exhausted / 429 → rate_limited · 5xx → unavailable · other non-2xx → http ·
 * 404 → not_found · fetch failure → network · abort → aborted/timeout · bad JSON → invalid_response.
 */
export async function offGetJson(
  context: OffHttpContext,
  url: string,
  limiter: RateLimiter,
  signal: AbortSignal | undefined,
): Promise<OffHttpResult> {
  if (signal?.aborted) throw toProviderError('off', signal.reason, signal)
  const permit = limiter.tryAcquire()
  if (!permit.ok) {
    throw new FoodProviderError('off', 'rate_limited', 'Open Food Facts request budget used up', permit.retryAfterMs)
  }
  let response: Response
  try {
    response = await context.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-User-Agent': context.userAgent },
      signal,
    })
  } catch (error) {
    throw toProviderError('off', error, signal, 'network')
  }
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'), context.now()) ?? OFF_DEFAULT_RETRY_MS
    limiter.blockFor(retryAfterMs)
    throw new FoodProviderError('off', 'rate_limited', 'Open Food Facts rate limit reached', retryAfterMs)
  }
  if (response.status === 404) return { status: 'not_found' }
  if (response.status >= 500) {
    throw new FoodProviderError('off', 'unavailable', `Open Food Facts is unavailable (HTTP ${response.status})`)
  }
  if (!response.ok) throw new FoodProviderError('off', 'http', `Open Food Facts answered HTTP ${response.status}`)
  try {
    return { status: 'ok', body: await response.json() }
  } catch (error) {
    if (signal?.aborted) throw toProviderError('off', error, signal)
    throw new FoodProviderError('off', 'invalid_response', 'Open Food Facts returned malformed JSON')
  }
}
