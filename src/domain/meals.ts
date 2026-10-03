import type { MealSlot, MealType } from '@/types'

/** Default meal structure. Kept as data so slots can become user-customizable later. */
export const DEFAULT_MEAL_SLOTS: readonly MealSlot[] = [
  { key: 'breakfast', label: 'Breakfast', startsAtHour: 5 },
  { key: 'lunch', label: 'Lunch', startsAtHour: 11 },
  { key: 'dinner', label: 'Dinner', startsAtHour: 17 },
  { key: 'snack', label: 'Snacks', startsAtHour: 0 },
]

export function mealLabel(mealType: MealType): string {
  return DEFAULT_MEAL_SLOTS.find((slot) => slot.key === mealType)?.label ?? mealType
}

/** Meal slot that best matches a local time (snacks are never the default). */
export function mealTypeForTime(date: Date): MealType {
  const hour = date.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 17) return 'lunch'
  return 'dinner'
}
