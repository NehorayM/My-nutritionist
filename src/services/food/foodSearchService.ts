import type { FoodItem } from '@/types'
import { createLruCache } from './cache'
import { lookupBarcodeAcrossProviders } from './barcodeLookup'
import { throwIfAborted } from './providerErrors'
import type { FoodProviderError, FoodProviderId, FoodSearchPage } from './providers/types'
import { uniqueAgainst } from './search/merge'
import { cacheKey, clampPage, readThrough, settle, statusOf, type Outcome } from './serviceSupport'
import type {
  CachedValue,
  FoodDetailsResult,
  FoodSearchCache,
  FoodSearchOptions,
  FoodSearchResult,
  FoodSearchService,
  FoodSearchServiceOptions,
} from './searchTypes'

export const LOCAL_PAGE_SIZE = 20
export const REMOTE_PAGE_SIZE = 15
/** Remote providers are only asked once the query has this many characters. */
export const MIN_REMOTE_QUERY_LENGTH = 2
export const DEFAULT_PROVIDER_TIMEOUT_MS = 8000

const readPage = (entry: CachedValue) => (entry.kind === 'page' ? entry.page : undefined)
const wrapPage = (page: FoodSearchPage): CachedValue => ({ kind: 'page', page })
const readDetail = (entry: CachedValue) => (entry.kind === 'detail' ? entry.food : undefined)
const wrapDetail = (food: FoodItem | null): CachedValue => ({ kind: 'detail', food })

function errorsOf(outcomes: Partial<Record<FoodProviderId, Outcome<unknown> | null>>) {
  const errors: Partial<Record<FoodProviderId, FoodProviderError>> = {}
  for (const [id, outcome] of Object.entries(outcomes) as [FoodProviderId, Outcome<unknown> | null][]) {
    if (outcome && !outcome.ok) errors[id] = outcome.error
  }
  return errors
}

/**
 * Orchestrates food search across providers (docs/FOOD_DATA_SOURCES.md):
 * - every provider call has its own time budget and AbortController linked to the caller's signal;
 * - failures are isolated: the result keeps the other providers' items and reports a per-provider status;
 * - successful remote pages are cached (LRU + TTL) by provider + query + page, local results never are
 *   (they are instant and change whenever the user saves a food);
 * - aborting the caller's signal rejects with the signal's reason (an AbortError) so stale searches are dropped.
 */
export function createFoodSearchService(options: FoodSearchServiceOptions): FoodSearchService {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const cache: FoodSearchCache | null = options.cache === undefined ? createLruCache<CachedValue>() : options.cache
  const { local } = options
  const usda = options.usda ?? null
  const off = options.off ?? null

  async function search(text: string, searchOptions: FoodSearchOptions = {}): Promise<FoodSearchResult> {
    const { signal } = searchOptions
    throwIfAborted(signal)
    const query = text.trim()
    const page = clampPage(searchOptions.page)
    const scope = searchOptions.usdaScope ?? 'generic'
    // Local results of pages 1…page in one cheap in-memory call: the current page is displayed and the
    // earlier ones are used to drop remote duplicates of foods the user has already seen.
    const localTask = settle(
      'local',
      (s) => local.search({ text: query, page: 1, pageSize: page * LOCAL_PAGE_SIZE, signal: s }),
      signal,
      timeoutMs,
    )
    const usdaTask =
      usda !== null && usda.isAvailable() && query.length >= MIN_REMOTE_QUERY_LENGTH
        ? settle(
            'usda',
            (s) =>
              readThrough(cache, cacheKey('usda', 'search', scope, query, page, REMOTE_PAGE_SIZE), readPage, wrapPage, () =>
                usda.search({ text: query, page, pageSize: REMOTE_PAGE_SIZE, signal: s, scope }),
              ),
            signal,
            timeoutMs,
          )
        : null
    const build = (
      localOutcome: Outcome<FoodSearchPage>,
      usdaOutcome: Outcome<FoodSearchPage> | null,
      usdaPending: boolean,
    ): FoodSearchResult => {
      const seenLocal = localOutcome.ok ? localOutcome.value.items : []
      const localItems = seenLocal.slice((page - 1) * LOCAL_PAGE_SIZE)
      const remoteItems = usdaOutcome?.ok ? uniqueAgainst(seenLocal, usdaOutcome.value.items, options.linkedRecordKey) : []
      return {
        query,
        page,
        items: [...localItems, ...remoteItems],
        hasMore: (localOutcome.ok && localOutcome.value.hasMore) || (usdaOutcome?.ok === true && usdaOutcome.value.hasMore),
        providerStatus: { local: statusOf(localOutcome), usda: usdaPending ? 'pending' : statusOf(usdaOutcome), off: 'skipped' },
        errors: errorsOf({ local: localOutcome, usda: usdaOutcome }),
      }
    }
    let complete = false
    const { onPartial } = searchOptions
    if (usdaTask !== null && onPartial) {
      void localTask.then((localOutcome) => {
        if (!complete && !signal?.aborted) onPartial(build(localOutcome, null, true))
      })
    }
    const [localOutcome, usdaOutcome] = await Promise.all([localTask, usdaTask])
    complete = true
    throwIfAborted(signal)
    return build(localOutcome, usdaOutcome, false)
  }

  async function searchPackaged(
    text: string,
    searchOptions: Omit<FoodSearchOptions, 'usdaScope'> = {},
  ): Promise<FoodSearchResult> {
    const { signal } = searchOptions
    throwIfAborted(signal)
    const query = text.trim()
    const page = clampPage(searchOptions.page)
    const offTask =
      off !== null && off.isAvailable() && query.length >= MIN_REMOTE_QUERY_LENGTH
        ? settle(
            'off',
            (s) =>
              readThrough(cache, cacheKey('off', 'search', query, page, REMOTE_PAGE_SIZE), readPage, wrapPage, () =>
                off.searchPackaged({ text: query, page, pageSize: REMOTE_PAGE_SIZE, signal: s }),
              ),
            signal,
            timeoutMs,
          )
        : null
    const outcome = await offTask
    throwIfAborted(signal)
    return {
      query,
      page,
      items: outcome?.ok ? uniqueAgainst([], outcome.value.items) : [],
      hasMore: outcome?.ok === true && outcome.value.hasMore,
      providerStatus: { local: 'skipped', usda: 'skipped', off: statusOf(outcome) },
      errors: errorsOf({ off: outcome }),
    }
  }

  async function getDetails(food: FoodItem, detailOptions: { signal?: AbortSignal } = {}): Promise<FoodDetailsResult> {
    const { signal } = detailOptions
    throwIfAborted(signal)
    if (food.source !== 'usda' || food.externalId === null || usda?.getFood === undefined || !usda.isAvailable()) {
      return { food, status: 'skipped' }
    }
    const getFood = usda.getFood.bind(usda)
    const fdcId = food.externalId
    const outcome = await settle(
      'usda',
      (s) => readThrough(cache, cacheKey('usda', 'food', fdcId), readDetail, wrapDetail, () => getFood(fdcId, s)),
      signal,
      timeoutMs,
    )
    throwIfAborted(signal)
    if (!outcome.ok) return { food, status: outcome.error.kind }
    if (outcome.value === null) return { food, status: 'ok' }
    // Keep identity and ownership of the food the user picked (it may be a saved copy).
    const { id, createdBy, createdAt, updatedAt } = food
    return { food: { ...outcome.value, id, createdBy, createdAt, updatedAt }, status: 'ok' }
  }

  return {
    search,
    searchPackaged,
    lookupBarcode: (code, lookupOptions = {}) =>
      lookupBarcodeAcrossProviders({ local, off, cache, timeoutMs }, code, lookupOptions.signal),
    getDetails,
    clearCache: () => cache?.clear(),
  }
}
