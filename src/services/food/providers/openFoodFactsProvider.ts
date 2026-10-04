import type { FoodItem } from '@/types'
import { normalizeBarcode } from '../normalize/barcode'
import { mapOffProduct } from '../normalize/off'
import {
  OFF_PRODUCT_FIELDS,
  offProductResponseSchema,
  offProductSchema,
  offSearchResponseSchema,
} from '../normalize/offSchema'
import { toProviderFood, toProviderFoods, type ProviderFoodDraft } from '../normalize/providerFood'
import { createTokenBucket, type RateLimiter } from '../rateLimiter'
import { OFF_BASE_URL, OFF_USER_AGENT, offGetJson, type OffHttpContext } from './offHttp'
import { FoodProviderError, type FoodProvider, type FoodSearchPage, type FoodSearchRequest } from './types'

/**
 * Open Food Facts, browser-direct (keyless, CORS `*`; per-IP limits therefore apply per user).
 * - search = "Search packaged products": an EXPLICIT action, never search-as-you-type
 *   (OFF allows 10 searches/min/IP and bans abusive IPs) → client bucket of 1 request / 6 s.
 * - barcode lookup: 15 product reads/min/IP → bucket of 3 with one token every 5 s (≤ 15 in any minute).
 */
export type OffBarcodeResult =
  | { status: 'found'; food: FoodItem }
  | { status: 'not_found' }
  | { status: 'invalid_code' }
  /** The product exists but lacks a name or any of calories/protein/carbs/fat. */
  | { status: 'incomplete'; productName: string | null }

export interface OpenFoodFactsProvider extends FoodProvider {
  /** Same as `search`: the explicit "Search packaged products" action. */
  searchPackaged(request: FoodSearchRequest): Promise<FoodSearchPage>
  lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem | null>
  lookupBarcodeDetailed(barcode: string, signal?: AbortSignal): Promise<OffBarcodeResult>
}

export interface OpenFoodFactsProviderOptions {
  fetch?: typeof fetch
  baseUrl?: string
  userAgent?: string
  now?: () => number
  searchLimiter?: RateLimiter
  productLimiter?: RateLimiter
}

export const OFF_SEARCH_INTERVAL_MS = 6000
export const OFF_PRODUCT_BURST = 3
export const OFF_PRODUCT_INTERVAL_MS = 5000
const MAX_QUERY_LENGTH = 100

export function createOpenFoodFactsProvider(options: OpenFoodFactsProviderOptions = {}): OpenFoodFactsProvider {
  const now = options.now ?? Date.now
  const baseUrl = (options.baseUrl ?? OFF_BASE_URL).replace(/\/+$/, '')
  const http: OffHttpContext = {
    // Resolved per call so tests and polyfills that replace globalThis.fetch are honored.
    fetch: (input, init) => (options.fetch ?? globalThis.fetch)(input, init),
    userAgent: options.userAgent ?? OFF_USER_AGENT,
    now,
  }
  const searchLimiter =
    options.searchLimiter ?? createTokenBucket({ capacity: 1, refillIntervalMs: OFF_SEARCH_INTERVAL_MS, now })
  const productLimiter =
    options.productLimiter ??
    createTokenBucket({ capacity: OFF_PRODUCT_BURST, refillIntervalMs: OFF_PRODUCT_INTERVAL_MS, now })
  const fields = OFF_PRODUCT_FIELDS.join(',')
  const timestamp = () => new Date(now()).toISOString()

  async function searchPackaged(request: FoodSearchRequest): Promise<FoodSearchPage> {
    const page = Math.max(1, Math.floor(request.page))
    const pageSize = Math.min(100, Math.max(1, Math.floor(request.pageSize)))
    const text = request.text.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
    if (text.length === 0) return { providerId: 'off', items: [], page, hasMore: false }
    const params = new URLSearchParams({
      search_terms: text,
      search_simple: '1',
      action: 'process',
      json: '1',
      page: String(page),
      page_size: String(pageSize),
      fields,
    })
    const result = await offGetJson(http, `${baseUrl}/cgi/search.pl?${params.toString()}`, searchLimiter, request.signal)
    if (result.status === 'not_found') throw new FoodProviderError('off', 'http', 'Open Food Facts search endpoint not found')
    const envelope = offSearchResponseSchema.safeParse(result.body)
    if (!envelope.success || !Number.isFinite(envelope.data.count)) {
      throw new FoodProviderError('off', 'invalid_response', 'Unexpected Open Food Facts search response')
    }
    const drafts: ProviderFoodDraft[] = []
    for (const raw of envelope.data.products) {
      const product = offProductSchema.safeParse(raw)
      if (!product.success) continue
      const mapped = mapOffProduct(product.data)
      if (mapped.ok) drafts.push(mapped.draft)
    }
    return {
      providerId: 'off',
      items: await toProviderFoods(drafts, timestamp()),
      page,
      hasMore: page * pageSize < envelope.data.count,
    }
  }

  async function lookupBarcodeDetailed(barcode: string, signal?: AbortSignal): Promise<OffBarcodeResult> {
    const code = normalizeBarcode(barcode)
    if (code === null) return { status: 'invalid_code' }
    const url = `${baseUrl}/api/v2/product/${code}?${new URLSearchParams({ fields }).toString()}`
    const result = await offGetJson(http, url, productLimiter, signal)
    if (result.status === 'not_found') return { status: 'not_found' }
    const envelope = offProductResponseSchema.safeParse(result.body)
    if (!envelope.success) throw new FoodProviderError('off', 'invalid_response', 'Unexpected Open Food Facts product response')
    // HTTP 200 with status 0 happens for invalid codes — check the JSON status, not only the HTTP code.
    if (envelope.data.status !== 1) {
      return /invalid/i.test(envelope.data.status_verbose ?? '') ? { status: 'invalid_code' } : { status: 'not_found' }
    }
    const product = offProductSchema.safeParse(envelope.data.product)
    if (!product.success) throw new FoodProviderError('off', 'invalid_response', 'Unexpected Open Food Facts product data')
    const mapped = mapOffProduct({ ...product.data, code: product.data.code ?? code })
    if (!mapped.ok) return { status: 'incomplete', productName: mapped.name }
    return { status: 'found', food: await toProviderFood(mapped.draft, timestamp()) }
  }

  return {
    id: 'off',
    label: 'Open Food Facts',
    isAvailable: () => true,
    search: searchPackaged,
    searchPackaged,
    lookupBarcodeDetailed,
    async lookupBarcode(barcode, signal) {
      const result = await lookupBarcodeDetailed(barcode, signal)
      return result.status === 'found' ? result.food : null
    },
  }
}
