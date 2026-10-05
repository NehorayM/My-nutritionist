import { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import type { FoodItem } from '@/types'
import { useFoodSearchService } from '../services/foodService'

interface FoodDetails {
  /** The full detail once loaded, otherwise the food that was passed in. */
  food: FoodItem
  /** True while household servings of a USDA food are being loaded. */
  loading: boolean
}

/**
 * USDA search results carry few household servings; this loads the full detail in the background. Other foods
 * are complete already. Failures keep the food as it is (grams always work).
 */
export function useFoodDetails(food: FoodItem): FoodDetails {
  const service = useFoodSearchService()
  const needsDetail = food.source === 'usda' && food.externalId !== null
  const [loaded, setLoaded] = useState<{ for: FoodItem; food: FoodItem } | null>(null)

  useEffect(() => {
    if (!needsDetail) return undefined
    const abort = new AbortController()
    service.getDetails(food, { signal: abort.signal }).then(
      (result) => {
        if (!abort.signal.aborted) setLoaded({ for: food, food: result.food })
      },
      (error: unknown) => {
        if (abort.signal.aborted) return
        logger.warn('meals.details', 'Loading food details failed', error)
        setLoaded({ for: food, food })
      },
    )
    return () => abort.abort()
  }, [food, needsDetail, service])

  const current = loaded?.for === food ? loaded.food : null
  return { food: current ?? food, loading: needsDetail && current === null }
}
