/**
 * USDA FoodData Central calls (https://fdc.nal.usda.gov/api-guide). The api.data.gov key travels in the
 * `X-Api-Key` header — never in a URL — so it cannot leak into logs. Every call is bounded by a timeout.
 */
import { FDC_NUTRIENT_NUMBERS } from '../_shared/usda/nutrients.ts'
import { fdcDataTypesForScope } from '../_shared/usda/types.ts'
import type { SearchRequest } from './request.ts'

export const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
export const UPSTREAM_TIMEOUT_MS = 8_000
/** Upstream blocks an over-quota key for one hour; used when a 429 carries no usable Retry-After. */
export const DEFAULT_RETRY_AFTER_SECONDS = '3600'

export type UpstreamResult =
  | { kind: 'ok'; body: unknown }
  | { kind: 'not_found' }
  | { kind: 'rate_limited'; retryAfter: string }
  | { kind: 'timeout' }
  | { kind: 'failed'; status: number | null; reason: 'network' | 'status' | 'invalid_json' }

export interface UsdaClientOptions {
  apiKey: string
  fetch: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

/** Forwards a valid Retry-After (delay-seconds or HTTP-date); anything else becomes one hour. */
export function normalizeRetryAfter(value: string | null): string {
  const trimmed = value?.trim() ?? ''
  if (/^\d{1,7}$/.test(trimmed)) return trimmed
  if (/[a-z]/i.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) return trimmed
  return DEFAULT_RETRY_AFTER_SECONDS
}

function isTimeout(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError'
}

/** Releases an unread body (Deno keeps the connection busy until a body is consumed or cancelled). */
async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // The stream was already closed; nothing left to release.
  }
}

interface UsdaCall {
  path: string
  method: 'GET' | 'POST'
  json?: unknown
}

async function callUsda(options: UsdaClientOptions, call: UsdaCall): Promise<UpstreamResult> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Api-Key': options.apiKey }
  if (call.json !== undefined) headers['Content-Type'] = 'application/json'
  const init: RequestInit = {
    method: call.method,
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? UPSTREAM_TIMEOUT_MS),
    ...(call.json === undefined ? {} : { body: JSON.stringify(call.json) }),
  }
  let response: Response
  try {
    response = await options.fetch(`${options.baseUrl ?? FDC_BASE_URL}${call.path}`, init)
  } catch (error) {
    return isTimeout(error) ? { kind: 'timeout' } : { kind: 'failed', status: null, reason: 'network' }
  }
  if (response.status === 429) {
    await discard(response)
    return { kind: 'rate_limited', retryAfter: normalizeRetryAfter(response.headers.get('Retry-After')) }
  }
  if (response.status === 404) {
    await discard(response)
    return { kind: 'not_found' }
  }
  if (!response.ok) {
    await discard(response)
    return { kind: 'failed', status: response.status, reason: 'status' }
  }
  try {
    return { kind: 'ok', body: await response.json() }
  } catch (error) {
    return isTimeout(error) ? { kind: 'timeout' } : { kind: 'failed', status: response.status, reason: 'invalid_json' }
  }
}

/** POST /v1/foods/search with the scope's dataType list (generic avoids the flood of branded duplicates). */
export function searchUsdaFoods(options: UsdaClientOptions, request: SearchRequest): Promise<UpstreamResult> {
  return callUsda(options, {
    path: '/foods/search',
    method: 'POST',
    json: {
      query: request.query,
      dataType: fdcDataTypesForScope(request.scope),
      pageSize: request.pageSize,
      // 1-based: FDC echoes pageNumber 1 / currentPage 1 for the first page.
      pageNumber: request.page,
    },
  })
}

/** GET /v1/food/{fdcId}?format=full&nutrients=… (portions/serving data + only the nutrients we map). */
export function fetchUsdaFood(options: UsdaClientOptions, fdcId: number): Promise<UpstreamResult> {
  // Nutrient numbers are digits and dots only, so the query string needs no escaping (≤ 25 accepted upstream).
  return callUsda(options, {
    path: `/food/${fdcId}?format=full&nutrients=${FDC_NUTRIENT_NUMBERS.join(',')}`,
    method: 'GET',
  })
}
