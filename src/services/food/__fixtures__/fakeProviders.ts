import { vi } from 'vitest'
import type { FoodItem } from '@/types'
import type { OffBarcodeResult } from '../providers/openFoodFactsProvider'
import type { FoodProviderId, FoodSearchPage, FoodSearchRequest } from '../providers/types'
import type { UsdaSearchRequest } from '../providers/usdaProvider'
import { testFood } from './foods'

export function page(providerId: FoodProviderId, items: FoodItem[], hasMore = false, pageNumber = 1): FoodSearchPage {
  return { providerId, items, page: pageNumber, hasMore }
}

/** A remote (unsaved) provider result. */
export function remoteFood(source: 'usda' | 'off', name: string, overrides: Partial<FoodItem> = {}): FoodItem {
  const externalId = overrides.externalId ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return testFood(name, { id: `${source}-${externalId}`, source, externalId, attribution: source, ...overrides })
}

export function fakeUsda(answer: (request: UsdaSearchRequest) => Promise<FoodSearchPage>) {
  let available = true
  return {
    search: vi.fn<(request: UsdaSearchRequest) => Promise<FoodSearchPage>>(answer),
    getFood: vi.fn<(fdcId: string | number, signal?: AbortSignal) => Promise<FoodItem | null>>(async () => null),
    isAvailable: () => available,
    setAvailable: (value: boolean) => {
      available = value
    },
  }
}

export function fakeOff() {
  return {
    isAvailable: () => true,
    searchPackaged: vi.fn<(request: FoodSearchRequest) => Promise<FoodSearchPage>>(async () => page('off', [])),
    lookupBarcodeDetailed: vi.fn<(barcode: string, signal?: AbortSignal) => Promise<OffBarcodeResult>>(async () => ({
      status: 'not_found',
    })),
  }
}

/** Never settles until its signal aborts, like a stalled request. */
export function hangUntilAborted<T>(signal: AbortSignal | undefined): Promise<T> {
  return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }))
}
