import { logger } from '@/lib/logger'
import type { FoodItem } from '@/types'
import { barcodeMatchKey } from '../normalize/barcode'
import { compareRanked, indexFood, prepareQuery, scoreFood, type IndexedFood } from '../search/scoring'
import type { FoodProvider, FoodSearchPage, FoodSearchRequest } from './types'

export interface LocalCatalogProviderOptions {
  /** Bundled system catalog (or a getter, e.g. for a lazily loaded catalog). */
  catalog: readonly FoodItem[] | (() => readonly FoodItem[])
  /** The current user's own foods (custom + saved provider foods). */
  getUserFoods: () => Promise<readonly FoodItem[]> | readonly FoodItem[]
}

export interface LocalCatalogProvider extends FoodProvider {
  lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem | null>
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason
}

/**
 * Instant, offline search over the system catalog and the user's foods (works in guest mode).
 * The catalog index is built once per catalog array; user foods are indexed per query (small set).
 */
export function createLocalCatalogProvider(options: LocalCatalogProviderOptions): LocalCatalogProvider {
  let indexedCatalog: { source: readonly FoodItem[]; entries: IndexedFood[] } | null = null

  function catalogEntries(): IndexedFood[] {
    const catalog = typeof options.catalog === 'function' ? options.catalog() : options.catalog
    if (indexedCatalog?.source !== catalog) {
      indexedCatalog = { source: catalog, entries: catalog.map((food) => indexFood(food, false)) }
    }
    return indexedCatalog.entries
  }

  async function userFoods(): Promise<readonly FoodItem[]> {
    try {
      return await options.getUserFoods()
    } catch (error) {
      // Catalog results are still useful when the local database is unavailable.
      logger.warn('food.local', 'Could not read user foods; searching the catalog only', error)
      return []
    }
  }

  async function allEntries(): Promise<IndexedFood[]> {
    const own = (await userFoods()).map((food) => indexFood(food, true))
    const ownIds = new Set(own.map((entry) => entry.food.id))
    return [...own, ...catalogEntries().filter((entry) => !ownIds.has(entry.food.id))]
  }

  return {
    id: 'local',
    label: 'Food catalog',
    isAvailable: () => true,

    async search(request: FoodSearchRequest): Promise<FoodSearchPage> {
      throwIfAborted(request.signal)
      const page = Math.max(1, Math.floor(request.page))
      const pageSize = Math.max(1, Math.floor(request.pageSize))
      const query = prepareQuery(request.text)
      if (query === null) return { providerId: 'local', items: [], page, hasMore: false }
      const entries = await allEntries()
      throwIfAborted(request.signal)
      const ranked = entries
        .map((entry) => ({ entry, score: scoreFood(query, entry) }))
        .filter((result) => result.score > 0)
        .sort(compareRanked)
      const start = (page - 1) * pageSize
      return {
        providerId: 'local',
        items: ranked.slice(start, start + pageSize).map((result) => result.entry.food),
        page,
        hasMore: ranked.length > start + pageSize,
      }
    },

    async lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem | null> {
      throwIfAborted(signal)
      const key = barcodeMatchKey(barcode)
      if (key === null) return null
      const entries = await allEntries()
      return entries.find((entry) => barcodeMatchKey(entry.food.barcode) === key)?.food ?? null
    },
  }
}
