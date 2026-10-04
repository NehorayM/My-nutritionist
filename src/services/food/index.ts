/**
 * Food data: providers (local catalog, USDA via Edge Function, Open Food Facts) behind one search service.
 * UI and stores use `getFoodSearchService()` and the normalized `FoodItem` shape only.
 */
export {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  LOCAL_PAGE_SIZE,
  MIN_REMOTE_QUERY_LENGTH,
  REMOTE_PAGE_SIZE,
  createFoodSearchService,
} from './foodSearchService'
export { createDefaultFoodSearchService, getFoodSearchService, type DefaultFoodSearchOptions } from './defaultService'
export type {
  BarcodeLookupResult,
  FoodDetailsResult,
  FoodSearchCache,
  FoodSearchOptions,
  FoodSearchResult,
  FoodSearchService,
  FoodSearchServiceOptions,
  ProviderStatus,
  ProviderStatusMap,
} from './searchTypes'
export { createLruCache, type LruCache, type LruCacheOptions } from './cache'
export { createTokenBucket, type RateLimiter } from './rateLimiter'
export {
  FoodProviderError,
  type FoodProvider,
  type FoodProviderErrorKind,
  type FoodProviderId,
  type FoodSearchPage,
  type FoodSearchRequest,
} from './providers/types'
export {
  createLocalCatalogProvider,
  type LocalCatalogProvider,
  type LocalCatalogProviderOptions,
} from './providers/localCatalogProvider'
export {
  OFF_PRODUCT_BURST,
  OFF_PRODUCT_INTERVAL_MS,
  OFF_SEARCH_INTERVAL_MS,
  createOpenFoodFactsProvider,
  type OffBarcodeResult,
  type OpenFoodFactsProvider,
  type OpenFoodFactsProviderOptions,
} from './providers/openFoodFactsProvider'
export { OFF_USER_AGENT } from './providers/offHttp'
export {
  createUsdaProvider,
  type InvokeFunction,
  type UsdaProvider,
  type UsdaProviderOptions,
  type UsdaSearchRequest,
} from './providers/usdaProvider'
export {
  OFF_ATTRIBUTION,
  cleanBarcodeInput,
  isUnsavedProviderFood,
  normalizeBarcode,
  providerFoodId,
  toSavedProviderFood,
} from './normalize'
export { USDA_SOURCE_NAME, type UsdaSearchScope } from './normalize/shared'
