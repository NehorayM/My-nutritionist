import { useEffect, useMemo, useState } from 'react'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import { buildAdaptivePlan, type AdaptivePlan } from '@/domain/adaptive'
import type { DailyTargets } from '@/domain/nutrition'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useMealsStore } from '@/stores/mealsStore'
import { useProfileStore } from '@/stores/profileStore'
import { useUiStore } from '@/stores/uiStore'
import type { MealEntry } from '@/types'

/** Re-evaluate "remaining meals" as the day goes on. */
const NOW_REFRESH_MS = 5 * 60_000

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), NOW_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export interface AdaptivePlanState {
  plan: AdaptivePlan
  /** "Show another option": rotates through equally good alternatives. */
  showAnother: () => void
  dismiss: (id: string) => void
  restore: (id: string) => void
}

/**
 * Builds the Adaptive Nutrition Engine plan from persisted state (the day's logged entries, profile, user
 * foods, favorites, recent foods and dismissals). Every log change recomputes it.
 */
export function useAdaptivePlan(date: string, entries: MealEntry[], targets: DailyTargets): AdaptivePlanState {
  const now = useNow()
  const [variant, setVariant] = useState(0)
  const profile = useProfileStore((s) => s.profile)
  const userFoods = useFoodLibraryStore((s) => s.userFoods)
  const favorites = useFoodLibraryStore((s) => s.favorites)
  const recentEntries = useMealsStore((s) => s.recentEntries)
  const dismissedIds = useUiStore((s) => s.dismissedFor(date))

  useEffect(() => {
    if (useMealsStore.getState().recentStatus === 'idle') void useMealsStore.getState().loadRecent()
  }, [])

  const foods = useMemo(() => [...SYSTEM_FOODS, ...userFoods], [userFoods])
  const favoriteFoodIds = useMemo(() => favorites.map((favorite) => favorite.foodId), [favorites])
  const recentFoodIds = useMemo(
    () => recentEntries.flatMap((entry) => (entry.foodId === null ? [] : [entry.foodId])),
    [recentEntries],
  )

  const plan = useMemo(
    () =>
      buildAdaptivePlan({
        profile,
        targets,
        entries,
        now,
        date,
        foods,
        favoriteFoodIds,
        recentFoodIds,
        dismissedIds: [...dismissedIds],
        variant,
      }),
    [profile, targets, entries, now, date, foods, favoriteFoodIds, recentFoodIds, dismissedIds, variant],
  )

  return {
    plan,
    showAnother: () => setVariant((v) => v + 1),
    dismiss: (id) => useUiStore.getState().dismissRecommendation(date, id),
    restore: (id) => useUiStore.getState().restoreRecommendation(date, id),
  }
}
