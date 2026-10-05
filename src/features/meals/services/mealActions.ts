import type { DateKey } from '@/domain/dates'
import { mealLabel } from '@/domain/meals'
import { notify } from '@/lib/notify'
import { useMealsStore } from '@/stores/mealsStore'
import type { FoodPortion, MealEntry, MealType } from '@/types'
import { formatPortionAmount } from '../model/portion'

/** Removes entries that were just created (Undo of a log action). */
async function undoCreated(entries: readonly MealEntry[]): Promise<void> {
  for (const entry of entries) {
    const result = await useMealsStore.getState().deleteEntry(entry.id)
    if (!result.ok) {
      notify.error(result.message)
      return
    }
  }
}

function foodsText(count: number): string {
  return `${count} ${count === 1 ? 'food' : 'foods'}`
}

interface LogOptions {
  /** Toast title; defaults to "Added to <Meal>". */
  message?: string
}

/**
 * Logs one or more portions to a meal of `date` and confirms with an Undo toast. Returns false (after showing
 * the reason) when nothing was saved.
 */
export async function logPortions(
  portions: readonly FoodPortion[],
  mealType: MealType,
  date: DateKey,
  options: LogOptions = {},
): Promise<boolean> {
  const result = await useMealsStore.getState().addPortions(portions, mealType, date)
  if (!result.ok) {
    notify.error(result.message)
    return false
  }
  const created = result.value
  const first = created[0]
  const description =
    created.length === 1 && first ? `${first.foodName} · ${formatPortionAmount(first)}` : foodsText(created.length)
  notify.success(options.message ?? `Added to ${mealLabel(mealType)}`, {
    description,
    undo: () => void undoCreated(created),
  })
  return true
}

/** Deletes an entry; the toast offers Undo, which restores it with the same id and snapshot. */
export async function removeEntry(entry: MealEntry): Promise<void> {
  const result = await useMealsStore.getState().deleteEntry(entry.id)
  if (!result.ok) {
    notify.error(result.message)
    return
  }
  notify.success(`Removed ${entry.foodName}`, {
    description: mealLabel(entry.mealType),
    undo: () => {
      void useMealsStore
        .getState()
        .restoreEntry(result.value)
        .then((restored) => {
          if (!restored.ok) notify.error(restored.message)
        })
    },
  })
}

/** Copies a meal of `fromDate` into the same meal of `toDate` ("Repeat yesterday’s breakfast"). */
export async function repeatMeal(fromDate: DateKey, toDate: DateKey, mealType: MealType, message: string): Promise<void> {
  const result = await useMealsStore.getState().copyMeal(fromDate, toDate, mealType)
  if (!result.ok) {
    notify.error(result.message)
    return
  }
  const created = result.value
  notify.success(message, { description: foodsText(created.length), undo: () => void undoCreated(created) })
}
