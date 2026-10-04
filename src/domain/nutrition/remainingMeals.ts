import { MEAL_TYPES, type MealEntry, type MealType } from '@/types'
import { compareDateKeys, minutesOfDay, toDateKey } from '../dates'
import { MEAL_WINDOW_END_MINUTES } from './constants'

/**
 * Meal slots still ahead on `date`, in display order:
 * - a past date → none; a future date → every slot;
 * - today → main meals (breakfast, lunch, dinner) with nothing logged whose window has not closed, plus
 *   snacks until their window closes (snacks stay open even after something was logged).
 * Windows: MEAL_WINDOW_END_MINUTES (breakfast < 11:00, lunch < 16:30, dinner < 22:00, snack < 23:00 local).
 */
export function remainingMealSlots(
  entries: ReadonlyArray<Pick<MealEntry, 'date' | 'mealType'>>,
  now: Date,
  date: string,
): MealType[] {
  const order = compareDateKeys(date, toDateKey(now))
  if (order < 0) return []
  if (order > 0) return [...MEAL_TYPES]

  const minutes = minutesOfDay(now)
  const logged = new Set(entries.filter((entry) => entry.date === date).map((entry) => entry.mealType))
  return MEAL_TYPES.filter((mealType) => {
    if (minutes >= MEAL_WINDOW_END_MINUTES[mealType]) return false
    return mealType === 'snack' || !logged.has(mealType)
  })
}
