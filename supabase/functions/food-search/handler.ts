/**
 * `food-search` request handler (docs/contracts/food-search-function.md). Runtime-agnostic: every dependency
 * (auth, secret, fetch, clock, log) is injected by index.ts, so the whole flow is unit-tested under Node.
 */
import { normalizeUsdaFoodResponse, normalizeUsdaSearchResponse } from '../_shared/usda/normalize.ts'
import type { UsdaFoodResponseDto, UsdaSearchResponseDto } from '../_shared/usda/types.ts'
import type { VerifyUser } from './auth.ts'
import { createLruCache } from './cache.ts'
import { errorResponse, jsonResponse, preflightResponse } from './http.ts'
import {
  MAX_BODY_CHARS,
  parseFoodSearchRequest,
  parseJsonBody,
  type FoodRequest,
  type SearchRequest,
} from './request.ts'
import { fetchUsdaFood, searchUsdaFoods, type UpstreamResult, type UsdaClientOptions } from './upstream.ts'

export const SEARCH_TTL_MS = 24 * 60 * 60 * 1000
export const FOOD_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const DEFAULT_CACHE_ENTRIES = 300

export type LogFn = (message: string, details: Record<string, unknown>) => void

export interface FoodSearchDeps {
  /** null when the function has no SUPABASE_URL / publishable key (it then answers 503 not_configured). */
  verifyUser: VerifyUser | null
  getApiKey: () => string | null
  fetch: typeof fetch
  now: () => number
  timeoutMs?: number
  cacheEntries?: number
  log?: LogFn
}

type Action = 'search' | 'food'

export function searchCacheKey(request: SearchRequest): string {
  return JSON.stringify([request.scope, request.page, request.pageSize, request.query.toLowerCase()])
}

function upstreamFailure(result: Exclude<UpstreamResult, { kind: 'ok' }>, action: Action, log: LogFn): Response {
  switch (result.kind) {
    case 'rate_limited':
      log('usda_rate_limited', { action, retryAfter: result.retryAfter })
      return errorResponse(429, 'rate_limited', 'USDA FoodData Central is busy. Please try again later.', {
        'Retry-After': result.retryAfter,
      })
    case 'timeout':
      log('usda_timeout', { action })
      return errorResponse(504, 'timeout', 'USDA FoodData Central did not answer in time.')
    case 'not_found':
      if (action === 'food') return errorResponse(404, 'not_found', 'USDA FoodData Central has no usable food with this id.')
      log('usda_unexpected_not_found', { action })
      return errorResponse(502, 'upstream_error', 'USDA FoodData Central returned an unexpected answer.')
    case 'failed':
      log('usda_failed', { action, status: result.status, reason: result.reason })
      return errorResponse(502, 'upstream_error', 'USDA FoodData Central returned an unexpected answer.')
  }
}

export function createFoodSearchHandler(deps: FoodSearchDeps): (request: Request) => Promise<Response> {
  const log: LogFn = deps.log ?? (() => undefined)
  const entries = deps.cacheEntries ?? DEFAULT_CACHE_ENTRIES
  const searchCache = createLruCache<UsdaSearchResponseDto>(entries, deps.now)
  const foodCache = createLruCache<UsdaFoodResponseDto>(entries, deps.now)

  function clientOptions(): UsdaClientOptions | null {
    const apiKey = deps.getApiKey()
    if (apiKey === null) return null
    return { apiKey, fetch: deps.fetch, ...(deps.timeoutMs === undefined ? {} : { timeoutMs: deps.timeoutMs }) }
  }

  function notConfigured(what: string): Response {
    log('not_configured', { missing: what })
    return errorResponse(503, 'not_configured', 'USDA search is not configured on this server.')
  }

  async function search(request: SearchRequest): Promise<Response> {
    const key = searchCacheKey(request)
    const cached = searchCache.get(key)
    if (cached) return jsonResponse(200, cached)
    const options = clientOptions()
    if (options === null) return notConfigured('FDC_API_KEY')
    const result = await searchUsdaFoods(options, request)
    if (result.kind !== 'ok') return upstreamFailure(result, 'search', log)
    const body = normalizeUsdaSearchResponse(result.body, request)
    if (body === null) return upstreamFailure({ kind: 'failed', status: 200, reason: 'invalid_json' }, 'search', log)
    searchCache.set(key, body, SEARCH_TTL_MS)
    return jsonResponse(200, body)
  }

  async function food(request: FoodRequest): Promise<Response> {
    const key = String(request.fdcId)
    const cached = foodCache.get(key)
    if (cached) return jsonResponse(200, cached)
    const options = clientOptions()
    if (options === null) return notConfigured('FDC_API_KEY')
    const result = await fetchUsdaFood(options, request.fdcId)
    if (result.kind !== 'ok') return upstreamFailure(result, 'food', log)
    const body = normalizeUsdaFoodResponse(result.body)
    if (body === null) return upstreamFailure({ kind: 'not_found' }, 'food', log)
    foodCache.set(key, body, FOOD_TTL_MS)
    return jsonResponse(200, body)
  }

  return async (request) => {
    if (request.method === 'OPTIONS') return preflightResponse()
    if (request.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', 'Use POST.', { Allow: 'POST, OPTIONS' })
    }
    if (deps.verifyUser === null) return notConfigured('SUPABASE_URL / publishable key')
    const userId = await deps.verifyUser(request.headers.get('Authorization'))
    if (userId === null) return errorResponse(401, 'unauthorized', 'Sign in to search USDA FoodData Central.')

    // Refuse an oversized body before buffering it (a UTF-8 character takes at most 4 bytes).
    const declaredLength = Number(request.headers.get('Content-Length') ?? '0')
    if (declaredLength > MAX_BODY_CHARS * 4) {
      return errorResponse(400, 'invalid_request', 'Request body is too large')
    }
    let text: string
    try {
      text = await request.text()
    } catch {
      return errorResponse(400, 'invalid_request', 'The request body could not be read.')
    }
    const json = parseJsonBody(text)
    if (!json.ok) return errorResponse(400, 'invalid_request', json.message)
    const parsed = parseFoodSearchRequest(json.value)
    if (!parsed.ok) return errorResponse(400, 'invalid_request', parsed.message)
    return parsed.value.action === 'search' ? search(parsed.value) : food(parsed.value)
  }
}
