import type { FoodItem } from '@/types'
import { abortedError, toProviderError } from '../providerErrors'
import { toProviderFood, toProviderFoods } from '../normalize/providerFood'
import {
  FOOD_SEARCH_FUNCTION,
  USDA_REQUEST_LIMITS,
  type UsdaFunctionRequest,
  type UsdaSearchScope,
} from '../normalize/shared'
import { usdaDtoToDraft } from '../normalize/usda'
import { parseUsdaFoodDto, usdaFoodEnvelopeSchema, usdaSearchEnvelopeSchema } from '../normalize/usdaSchema'
import { classifyUsdaError } from './usdaErrors'
import { FoodProviderError, type FoodProvider, type FoodSearchPage, type FoodSearchRequest } from './types'

/**
 * USDA FoodData Central through the `food-search` Supabase Edge Function (the API key stays server-side).
 * The function already returns normalized `UsdaFoodDto`s; this provider validates them with Zod and turns
 * them into `FoodItem`s with transient ids (see normalize/providerFood.ts).
 */

/** Shape of `supabase.functions.invoke` that this provider needs (kept minimal for tests). */
export type InvokeFunction = (
  functionName: string,
  options: { body: UsdaFunctionRequest; signal?: AbortSignal },
) => Promise<{ data: unknown; error: unknown }>

export interface UsdaProviderOptions {
  invoke: InvokeFunction
  /** True when the function may be called (Supabase configured and a user signed in). */
  isAvailable: () => boolean
  /** Default search scope: generic foods (Foundation, SR Legacy, Survey) unless told otherwise. */
  scope?: UsdaSearchScope
  functionName?: string
  now?: () => number
}

export interface UsdaSearchRequest extends FoodSearchRequest {
  /** 'branded' searches packaged US products instead of generic foods. */
  scope?: UsdaSearchScope
}

export interface UsdaProvider extends FoodProvider {
  search(request: UsdaSearchRequest): Promise<FoodSearchPage>
  /** Full detail (all portions) for one fdcId; null when USDA does not know it. */
  getFood(fdcId: string | number, signal?: AbortSignal): Promise<FoodItem | null>
}

const NOT_FOUND = Symbol('usda-not-found')

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(Number.isFinite(value) ? value : min)))
}

export function createUsdaProvider(options: UsdaProviderOptions): UsdaProvider {
  const now = options.now ?? Date.now
  const functionName = options.functionName ?? FOOD_SEARCH_FUNCTION
  const defaultScope = options.scope ?? 'generic'
  const timestamp = () => new Date(now()).toISOString()
  /** After a 429 the function is not called again until the advertised wait has passed. */
  let blockedUntil = 0

  async function call(body: UsdaFunctionRequest, signal: AbortSignal | undefined): Promise<unknown> {
    if (signal?.aborted) throw abortedError('usda', signal)
    if (!options.isAvailable()) throw new FoodProviderError('usda', 'unavailable', 'USDA search needs a signed-in account')
    const waitMs = blockedUntil - now()
    if (waitMs > 0) throw new FoodProviderError('usda', 'rate_limited', 'USDA search limit reached', waitMs)
    let response: { data: unknown; error: unknown }
    try {
      response = await options.invoke(functionName, { body, signal })
    } catch (error) {
      throw toProviderError('usda', error, signal, 'network')
    }
    if (response.error === null || response.error === undefined) {
      if (signal?.aborted) throw abortedError('usda', signal)
      return response.data
    }
    const outcome = await classifyUsdaError(response.error, body.action, signal, now())
    if (outcome.kind === 'not_found') return NOT_FOUND
    if (outcome.error.kind === 'rate_limited' && outcome.error.retryAfterMs !== null) {
      blockedUntil = now() + outcome.error.retryAfterMs
    }
    throw outcome.error
  }

  async function search(request: UsdaSearchRequest): Promise<FoodSearchPage> {
    const page = clampInt(request.page, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = clampInt(request.pageSize, 1, USDA_REQUEST_LIMITS.pageSizeMax)
    const query = request.text.replace(/\s+/g, ' ').trim().slice(0, USDA_REQUEST_LIMITS.queryMax)
    const empty: FoodSearchPage = { providerId: 'usda', items: [], page, hasMore: false }
    if (query.length < USDA_REQUEST_LIMITS.queryMin || page > USDA_REQUEST_LIMITS.pageMax) return empty
    const scope = request.scope ?? defaultScope
    const data = await call({ action: 'search', query, page, pageSize, scope }, request.signal)
    if (data === NOT_FOUND) throw new FoodProviderError('usda', 'unavailable', 'USDA search is not available')
    const envelope = usdaSearchEnvelopeSchema.safeParse(data)
    if (!envelope.success) throw new FoodProviderError('usda', 'invalid_response', 'Unexpected USDA search response')
    const dtos = envelope.data.foods.map(parseUsdaFoodDto).filter((dto) => dto !== null)
    // One malformed item is skipped; a page where nothing matches the contract means the contract drifted.
    if (dtos.length === 0 && envelope.data.foods.length > 0) {
      throw new FoodProviderError('usda', 'invalid_response', 'USDA search results did not match the contract')
    }
    return {
      providerId: 'usda',
      items: await toProviderFoods(dtos.map(usdaDtoToDraft), timestamp()),
      page,
      hasMore: page < Math.min(envelope.data.totalPages, USDA_REQUEST_LIMITS.pageMax),
    }
  }

  async function getFood(fdcId: string | number, signal?: AbortSignal): Promise<FoodItem | null> {
    const id = typeof fdcId === 'number' ? fdcId : /^\d{1,15}$/.test(fdcId.trim()) ? Number(fdcId.trim()) : NaN
    if (!Number.isSafeInteger(id) || id <= 0) return null
    const data = await call({ action: 'food', fdcId: id }, signal)
    if (data === NOT_FOUND) return null
    const envelope = usdaFoodEnvelopeSchema.safeParse(data)
    const dto = envelope.success ? parseUsdaFoodDto(envelope.data.food) : null
    if (dto === null) throw new FoodProviderError('usda', 'invalid_response', 'Unexpected USDA food response')
    return toProviderFood(usdaDtoToDraft(dto), timestamp())
  }

  return {
    id: 'usda',
    label: 'USDA FoodData Central',
    isAvailable: () => options.isAvailable(),
    search,
    getFood,
  }
}
