import type { KitchenEquipment, MealType } from '@/types'

/** Share of the day's energy each meal gets when its range is not set (normalized over planned meals). */
export const MEAL_SHARES: Readonly<Record<MealType, number>> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }

/** Derived ranges: a meal target ±15 %, the daily target ±10 % (when the targets give no range). */
export const MEAL_RANGE_TOLERANCE = 0.15
export const DAILY_RANGE_TOLERANCE = 0.1

/** Minutes to warm up a ready-cooked item; each extra item cooked from raw adds a few minutes of work. */
export const REHEAT_MINUTES = 3
export const EXTRA_COOKED_ITEM_MINUTES = 5

/** Preferred equipment, in order, when several are available. */
export const REHEAT_PREFERENCE: readonly KitchenEquipment[] = ['microwave', 'stove', 'oven']
export const COOK_PREFERENCE: readonly KitchenEquipment[] = ['stove', 'oven', 'microwave']

/** Options shown per meal, and considered when composing the day. */
export const OPTIONS_PER_MEAL = 3
export const DAY_CANDIDATES_PER_MEAL = 8

/** Best items per role kept for combination (keeps the search small and fast). */
export const TOP_ITEMS_PER_ROLE = 4
export const MAX_ITEMS: Readonly<Record<'main' | 'snack', number>> = { main: 4, snack: 2 }

/** Items whose use-by date is at most this many days away are used first. */
export const USE_SOON_DAYS = 2

/** The same pantry item in two meals of one day costs this much score. */
export const REPEAT_PENALTY = 0.15

/** Score weights of one meal option (sum 1; a small deterministic jitter varies "other options"). */
export const SCORE_WEIGHTS = { fit: 0.25, protein: 0.2, balance: 0.2, fiber: 0.1, prep: 0.1, mealFit: 0.1, useSoon: 0.05 } as const
export const VARIANT_JITTER = 0.08

/** Smallest portion worth planning when little is left (grams). */
export const MIN_PORTION_GRAMS = 10
