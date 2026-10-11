import { useMemo, useState } from 'react'
import { planMeals, type PlannerResult } from '@/domain/planner'
import { useToday } from '@/hooks/useToday'
import { useDailyTargets } from '@/stores/derived'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useKitchenStore } from '@/stores/kitchenStore'
import { useProfileStore } from '@/stores/profileStore'

export interface KitchenPlan {
  result: PlannerResult | null
  today: string
  /** Shows other (still valid) options; `reset` returns to the best ones. */
  variant: number
  nextVariant: () => void
  reset: () => void
}

/** Today's plan from the pantry and planner settings (computed with the planner engine, never inline). */
export function useKitchenPlan(): KitchenPlan {
  const today = useToday()
  const pantry = useKitchenStore((s) => s.pantry)
  const settings = useKitchenStore((s) => s.settings)
  const profile = useProfileStore((s) => s.profile)
  const favorites = useFoodLibraryStore((s) => s.favorites)
  const targets = useDailyTargets(today)
  const [variant, setVariant] = useState(0)
  const calories = targets.targets.calories

  const result = useMemo(() => {
    if (!settings || !calories) return null
    return planMeals({
      pantry,
      settings,
      calories: { amount: calories.amount, min: calories.min, max: calories.max },
      profile,
      favoriteFoodIds: favorites.map((favorite) => favorite.foodId),
      today,
      variant,
    })
  }, [pantry, settings, calories, profile, favorites, today, variant])

  return { result, today, variant, nextVariant: () => setVariant((v) => v + 1), reset: () => setVariant(0) }
}
