import type { MealOption } from '@/domain/planner'
import { mealLabel } from '@/domain/meals'
import { notify } from '@/lib/notify'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useKitchenStore } from '@/stores/kitchenStore'
import { useMealsStore } from '@/stores/mealsStore'
import type { FoodPortion, MealType, PantryItem } from '@/types'

/**
 * Planned items as loggable portions. Only foods that certainly exist on the server are referenced by id
 * (catalog foods and the user's saved foods); other snapshots keep `foodId: null` like unsaved provider results.
 */
export function plannedPortions(option: MealOption): FoodPortion[] {
  const ownFoods = new Set(useFoodLibraryStore.getState().userFoods.map((food) => food.id))
  return option.items.map(({ food, grams, quantity, servingLabel, servingGrams }) => ({
    foodId: food.source === 'system' || ownFoods.has(food.id) ? food.id : null,
    foodSource: food.source,
    foodExternalId: food.externalId,
    foodName: food.name,
    brand: food.brand,
    quantity,
    servingLabel,
    servingGrams,
    grams,
    per100g: { ...food.per100g },
  }))
}

/** Logs a planned meal to today and (optionally) takes the amounts out of the kitchen; offers Undo. */
export async function logPlannedMeal(option: MealOption, date: string, updateKitchen: boolean): Promise<boolean> {
  const mealType: MealType = option.mealType
  const logged = await useMealsStore.getState().addPortions(plannedPortions(option), mealType, date)
  if (!logged.ok) {
    notify.error(logged.message)
    return false
  }
  const before = useKitchenStore.getState().pantry
  const usage = Object.fromEntries(option.items.map((item) => [item.pantryItemId, item.grams]))
  if (updateKitchen) {
    const consumed = await useKitchenStore.getState().consume(usage)
    if (!consumed.ok) notify.error(consumed.message)
  }
  notify.success(`Logged to ${mealLabel(mealType)}`, {
    description: updateKitchen ? 'Your kitchen was updated.' : undefined,
    undo: () => void undoPlannedMeal(logged.value.map((entry) => entry.id), updateKitchen ? before.filter((item) => item.id in usage) : []),
  })
  return true
}

async function undoPlannedMeal(entryIds: readonly string[], kitchenBefore: readonly PantryItem[]): Promise<void> {
  await Promise.all(entryIds.map((id) => useMealsStore.getState().deleteEntry(id)))
  for (const item of kitchenBefore) await useKitchenStore.getState().restoreItem(item)
}

/** Removes a pantry item with Undo. */
export async function removePantryItem(id: string): Promise<void> {
  const removed = await useKitchenStore.getState().removeItem(id)
  if (!removed.ok) {
    notify.error(removed.message)
    return
  }
  notify.success(`Removed ${removed.value.food.name}`, { undo: () => void useKitchenStore.getState().restoreItem(removed.value) })
}
