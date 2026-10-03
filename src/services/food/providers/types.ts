import type { FoodItem } from '@/types'

/**
 * Food data provider contract. The UI never sees provider response formats:
 * every provider normalizes into `FoodItem` (per-100 g nutrients, unknown = null).
 */
export type FoodProviderId = 'local' | 'usda' | 'off'

export interface FoodSearchRequest {
  text: string
  /** 1-based page number. */
  page: number
  pageSize: number
  signal?: AbortSignal
}

export interface FoodSearchPage {
  providerId: FoodProviderId
  items: FoodItem[]
  page: number
  hasMore: boolean
}

export interface FoodProvider {
  readonly id: FoodProviderId
  /** Display name used for attribution, e.g. "USDA FoodData Central". */
  readonly label: string
  /** Whether the provider can currently be queried (e.g. USDA requires the server proxy). */
  isAvailable(): boolean
  search(request: FoodSearchRequest): Promise<FoodSearchPage>
  /** Optional barcode lookup; resolves null when the product is unknown. */
  lookupBarcode?(barcode: string, signal?: AbortSignal): Promise<FoodItem | null>
}

export type FoodProviderErrorKind =
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'invalid_response'
  | 'unavailable'
  | 'http'
  | 'aborted'

export class FoodProviderError extends Error {
  readonly kind: FoodProviderErrorKind
  readonly providerId: FoodProviderId
  /** Suggested wait before retrying (rate limiting), when known. */
  readonly retryAfterMs: number | null

  constructor(
    providerId: FoodProviderId,
    kind: FoodProviderErrorKind,
    message: string,
    retryAfterMs: number | null = null,
  ) {
    super(message)
    this.name = 'FoodProviderError'
    this.providerId = providerId
    this.kind = kind
    this.retryAfterMs = retryAfterMs
  }
}
