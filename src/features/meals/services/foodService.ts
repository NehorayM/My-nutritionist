import { createContext, useContext } from 'react'
import { getFoodSearchService, type FoodSearchService } from '@/services/food'

/**
 * Seam for the food search service: the app uses the shared `getFoodSearchService()`; tests (or a future
 * host) provide another instance with `<FoodServiceContext value={service}>`.
 */
export const FoodServiceContext = createContext<FoodSearchService | null>(null)

export function useFoodSearchService(): FoodSearchService {
  return useContext(FoodServiceContext) ?? getFoodSearchService()
}
