import type { FoodItem } from '@/types'
import type { LruCache } from './cache'
import type { LocalCatalogProvider } from './providers/localCatalogProvider'
import type { OffBarcodeResult, OpenFoodFactsProvider } from './providers/openFoodFactsProvider'
import type {
  FoodProviderError,
  FoodProviderErrorKind,
  FoodProviderId,
  FoodSearchPage,
} from './providers/types'
import type { UsdaProvider } from './providers/usdaProvider'
import type { UsdaSearchScope } from './normalize/shared'

/** Per-provider outcome of one call: 'skipped' = not queried (unavailable, query too short, not this action). */
export type ProviderStatus = 'ok' | 'skipped' | FoodProviderErrorKind
export type ProviderStatusMap = Record<FoodProviderId, ProviderStatus>

export interface FoodSearchOptions {
  /** 1-based page; each page holds up to 20 local + 15 remote results. */
  page?: number
  signal?: AbortSignal
  /** USDA data types to search: generic foods (default) or branded packaged products. */
  usdaScope?: UsdaSearchScope
}

export interface FoodSearchResult {
  /** Trimmed search text. */
  query: string
  page: number
  /** Local results first, then remote results that are not duplicates. */
  items: FoodItem[]
  /** True when any provider has another page. */
  hasMore: boolean
  providerStatus: ProviderStatusMap
  /** Failed providers' errors (e.g. `retryAfterMs` for 'rate_limited'). */
  errors: Partial<Record<FoodProviderId, FoodProviderError>>
}

export type BarcodeLookupResult =
  | { status: 'found'; food: FoodItem; providerId: FoodProviderId }
  | { status: 'not_found'; barcode: string }
  /** The product exists in Open Food Facts but lacks a name or nutrition facts. */
  | { status: 'incomplete'; barcode: string; productName: string | null }
  | { status: 'invalid_code' }
  | { status: 'error'; barcode: string; error: FoodProviderError }

export interface FoodDetailsResult {
  /** Full detail when it could be loaded, otherwise the food that was passed in. */
  food: FoodItem
  status: ProviderStatus
}

export interface FoodSearchService {
  /** Search-as-you-type: local catalog + user foods always, USDA when available and the query has ≥ 2 characters. */
  search(text: string, options?: FoodSearchOptions): Promise<FoodSearchResult>
  /** Explicit "Search packaged products" action (Open Food Facts; rate-limited, never on keystrokes). */
  searchPackaged(text: string, options?: Omit<FoodSearchOptions, 'usdaScope'>): Promise<FoodSearchResult>
  /** Local foods first (user's saved products, catalog), then Open Food Facts. */
  lookupBarcode(code: string, options?: { signal?: AbortSignal }): Promise<BarcodeLookupResult>
  /** USDA search results carry few portions; this loads the full detail (all household servings). */
  getDetails(food: FoodItem, options?: { signal?: AbortSignal }): Promise<FoodDetailsResult>
  clearCache(): void
}

export type CachedValue =
  | { kind: 'page'; page: FoodSearchPage }
  | { kind: 'barcode'; result: OffBarcodeResult }
  | { kind: 'detail'; food: FoodItem | null }

export type FoodSearchCache = LruCache<CachedValue>

export type LocalSearchProvider = Pick<LocalCatalogProvider, 'search'> & Partial<Pick<LocalCatalogProvider, 'lookupBarcode'>>
export type UsdaSearchProvider = Pick<UsdaProvider, 'isAvailable' | 'search'> & Partial<Pick<UsdaProvider, 'getFood'>>
export type PackagedSearchProvider = Pick<OpenFoodFactsProvider, 'isAvailable' | 'searchPackaged' | 'lookupBarcodeDetailed'>

export interface FoodSearchServiceOptions {
  local: LocalSearchProvider
  usda?: UsdaSearchProvider | null
  off?: PackagedSearchProvider | null
  /** Remote result cache; defaults to an LRU of 50 entries / 10 minutes. `null` disables caching. */
  cache?: FoodSearchCache | null
  /** Time budget per provider call. */
  timeoutMs?: number
  /**
   * Upstream record of a local food, as "<source>:<externalId>" (e.g. the USDA fdcId a catalog food was built
   * from), so the same USDA record is not listed twice under two names.
   */
  linkedRecordKey?: (food: FoodItem) => string | null
}
