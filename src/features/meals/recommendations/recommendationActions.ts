import type { MealRecommendation, RecommendedItem } from '@/domain/adaptive'
import { mealLabel } from '@/domain/meals'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useMealsStore } from '@/stores/mealsStore'
import type { FoodPortion, MealType } from '@/types'

/** A recommended item as a loggable portion, with its nutrition snapshot. */
export function toPortion(item: RecommendedItem): FoodPortion {
  const { food } = item
  return {
    foodId: food.id,
    foodSource: food.source,
    foodExternalId: food.externalId,
    foodName: food.name,
    brand: food.brand,
    quantity: item.quantity,
    servingLabel: item.servingLabel,
    servingGrams: item.servingGrams,
    grams: item.grams,
    per100g: { ...food.per100g },
  }
}

/** Logs every item of a recommendation into `mealType` of `date`; offers Undo. */
export async function logRecommendation(rec: MealRecommendation, mealType: MealType, date: string): Promise<boolean> {
  const result = await useMealsStore.getState().addPortions(rec.items.map(toPortion), mealType, date)
  if (!result.ok) {
    notify.error(result.message)
    return false
  }
  const created = result.value
  notify.success(`Added ${rec.title} to ${mealLabel(mealType)}`, {
    undo: () => {
      void Promise.all(created.map((entry) => useMealsStore.getState().deleteEntry(entry.id)))
    },
  })
  return true
}

/** Saves a recommendation as a meal template (Add Food › Saved meals). */
export async function saveRecommendation(rec: MealRecommendation): Promise<void> {
  const result = await useFoodLibraryStore.getState().saveMeal(rec.title, rec.items.map(toPortion), rec.mealType)
  if (result.ok) notify.success(`Saved “${rec.title}” to your meals`)
  else notify.error(result.message)
}
