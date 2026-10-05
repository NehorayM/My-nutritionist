/**
 * Validation of the `food-search` request body (docs/contracts/food-search-function.md).
 * Plain TypeScript (no Deno globals) so it is unit-tested with Vitest.
 */
import {
  USDA_REQUEST_LIMITS,
  USDA_SEARCH_SCOPES,
  type UsdaFunctionRequest,
  type UsdaSearchScope,
} from '../_shared/usda/types.ts'

export type SearchRequest = Extract<UsdaFunctionRequest, { action: 'search' }>
export type FoodRequest = Extract<UsdaFunctionRequest, { action: 'food' }>

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * Generous for `{ action, query (≤ 100 chars), page, pageSize, scope }`. The handler also refuses a larger
 * declared Content-Length before reading the body.
 */
export const MAX_BODY_CHARS = 2_048
export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 20

function fail<T>(message: string): ParseResult<T> {
  return { ok: false, message }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedInteger(value: unknown, fallback: number, max: number, field: string): ParseResult<number> {
  if (value === undefined) return { ok: true, value: fallback }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    return fail(`${field} must be an integer from 1 to ${max}`)
  }
  return { ok: true, value }
}

function isScope(value: unknown): value is UsdaSearchScope {
  return typeof value === 'string' && (USDA_SEARCH_SCOPES as readonly string[]).includes(value)
}

function parseSearch(body: Record<string, unknown>): ParseResult<SearchRequest> {
  if (typeof body.query !== 'string') return fail('query must be a string')
  const query = body.query.replace(/\s+/g, ' ').trim()
  if (query.length < USDA_REQUEST_LIMITS.queryMin || query.length > USDA_REQUEST_LIMITS.queryMax) {
    return fail(`query must be ${USDA_REQUEST_LIMITS.queryMin}–${USDA_REQUEST_LIMITS.queryMax} characters`)
  }
  const page = boundedInteger(body.page, DEFAULT_PAGE, USDA_REQUEST_LIMITS.pageMax, 'page')
  if (!page.ok) return page
  const pageSize = boundedInteger(body.pageSize, DEFAULT_PAGE_SIZE, USDA_REQUEST_LIMITS.pageSizeMax, 'pageSize')
  if (!pageSize.ok) return pageSize
  const scope = body.scope === undefined ? 'generic' : body.scope
  if (!isScope(scope)) return fail(`scope must be one of: ${USDA_SEARCH_SCOPES.join(', ')}`)
  return { ok: true, value: { action: 'search', query, page: page.value, pageSize: pageSize.value, scope } }
}

function parseFood(body: Record<string, unknown>): ParseResult<FoodRequest> {
  const { fdcId } = body
  if (typeof fdcId !== 'number' || !Number.isSafeInteger(fdcId) || fdcId <= 0) {
    return fail('fdcId must be a positive integer')
  }
  return { ok: true, value: { action: 'food', fdcId } }
}

/** Validates a parsed JSON body. Unknown extra fields are ignored. */
export function parseFoodSearchRequest(body: unknown): ParseResult<UsdaFunctionRequest> {
  if (!isPlainObject(body)) return fail('Request body must be a JSON object')
  if (body.action === 'search') return parseSearch(body)
  if (body.action === 'food') return parseFood(body)
  return fail('action must be "search" or "food"')
}

/** Parses raw body text as JSON with a size limit. */
export function parseJsonBody(text: string): ParseResult<unknown> {
  if (text.length > MAX_BODY_CHARS) return fail('Request body is too large')
  if (text.trim().length === 0) return fail('Request body is empty')
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return fail('Request body must be valid JSON')
  }
}
