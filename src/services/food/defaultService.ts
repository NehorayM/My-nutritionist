import type { SupabaseClient } from '@supabase/supabase-js'
import { SYSTEM_FOODS, systemFoodProvenance } from '@/data/systemFoods'
import { getSupabase } from '@/lib/supabase'
import { getRepositories, hasRepositories } from '@/services/runtime'
import type { FoodItem } from '@/types'
import { createFoodSearchService } from './foodSearchService'
import { createLocalCatalogProvider } from './providers/localCatalogProvider'
import { createOpenFoodFactsProvider } from './providers/openFoodFactsProvider'
import { FoodProviderError } from './providers/types'
import { createUsdaProvider, type InvokeFunction } from './providers/usdaProvider'
import type { FoodSearchService } from './searchTypes'

export interface DefaultFoodSearchOptions {
  /** The user's own foods; defaults to the active session's food repository (none before bootstrap). */
  getUserFoods?: () => Promise<readonly FoodItem[]>
  /** Whether USDA may be queried; defaults to "Supabase configured and a user is signed in". */
  isUsdaAvailable?: () => boolean
  /** Supabase client used for the `food-search` Edge Function; defaults to the shared client (null = offline). */
  supabase?: SupabaseClient | null
}

/** Catalog foods are built from USDA records: a USDA result with the same fdcId is the same food. */
function catalogUsdaRecord(food: FoodItem): string | null {
  if (food.source !== 'system') return null
  const provenance = systemFoodProvenance(food.id)
  return provenance === undefined ? null : `usda:${provenance.fdcId}`
}

function repositoryUserFoods(): Promise<readonly FoodItem[]> {
  return hasRepositories() ? getRepositories().foods.list() : Promise.resolve([])
}

/** USDA needs a signed-in user's JWT (the function rejects anonymous callers to protect the shared quota). */
function sessionTracker(client: SupabaseClient | null): () => boolean {
  if (client === null) return () => false
  let signedIn = false
  client.auth.onAuthStateChange((_event, session) => {
    signedIn = session !== null
  })
  return () => signedIn
}

function functionInvoker(client: SupabaseClient | null): InvokeFunction {
  if (client === null) {
    return () => Promise.reject(new FoodProviderError('usda', 'unavailable', 'Supabase is not configured'))
  }
  return (functionName, request) => client.functions.invoke(functionName, request)
}

/**
 * Production wiring: bundled system catalog + user foods (always), USDA through the Edge Function
 * (cloud mode only), Open Food Facts browser-direct (barcode + explicit packaged search).
 */
export function createDefaultFoodSearchService(options: DefaultFoodSearchOptions = {}): FoodSearchService {
  const client = options.supabase === undefined ? getSupabase() : options.supabase
  return createFoodSearchService({
    local: createLocalCatalogProvider({
      catalog: SYSTEM_FOODS,
      getUserFoods: options.getUserFoods ?? repositoryUserFoods,
    }),
    usda: createUsdaProvider({
      invoke: functionInvoker(client),
      isAvailable: options.isUsdaAvailable ?? sessionTracker(client),
    }),
    off: createOpenFoodFactsProvider(),
    linkedRecordKey: catalogUsdaRecord,
  })
}

let shared: FoodSearchService | null = null

/** App-wide service instance (one cache and one Open Food Facts rate limiter for the whole app). */
export function getFoodSearchService(): FoodSearchService {
  shared ??= createDefaultFoodSearchService()
  return shared
}
