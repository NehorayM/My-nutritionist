import type { FoodItem, KitchenEquipment, MealType, PantryItem, PantryPrep, PlannerSettings } from '@/types'
import type { AdaptivePreferences } from '../adaptive'
import type { MealBlock, PantryExclusion } from './feasibility'
import type { CalorieTarget, KcalRange } from './ranges'

export interface PlannerInput {
  pantry: readonly PantryItem[]
  settings: PlannerSettings
  /** The day's calorie target (from `calculateDailyTargets(...).targets.calories`). */
  calories: CalorieTarget
  /** Diet, allergies… (null before onboarding → app defaults). */
  profile: AdaptivePreferences | null
  /** Favorite foods may include occasional foods. */
  favoriteFoodIds?: readonly string[]
  /** Local date the plan is for (use-by dates are compared with it). */
  today: string
  /** 0 = best options; other values give other (still valid) options. */
  variant?: number
}

export interface PlannedItem {
  pantryItemId: string
  food: FoodItem
  grams: number
  /** Household units when they fit, otherwise grams (as in logged portions). */
  quantity: number
  servingLabel: string | null
  servingGrams: number | null
  prep: PantryPrep
  /** Equipment used to warm or cook it; null when eaten as is. */
  equipment: KitchenEquipment | null
  kcal: number
}

export interface PlanTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface MealOption {
  /** Deterministic: meal + pantry items + grams. */
  id: string
  mealType: MealType
  items: PlannedItem[]
  totals: PlanTotals
  prepMinutes: number
  /** Includes something to use within a couple of days. */
  usesSoon: boolean
  score: number
}

/** Why a meal has no option. */
export type MealGap = 'disabled' | 'nothing_available' | MealBlock | 'calories_out_of_reach'

export interface MealPlan {
  mealType: MealType
  range: KcalRange
  /** Best first; every option respects the pantry, the meal's equipment/cooking/time limits and its calorie range. */
  options: MealOption[]
  /** Set when there is no option. */
  gap: MealGap | null
}

export interface DayPlan {
  /** One option per meal that has any. */
  meals: Partial<Record<MealType, MealOption>>
  totals: PlanTotals
  /** Grams used per pantry item (never more than is at home). */
  usage: Record<string, number>
  /** True when the day's total is within the daily range and every planned meal has an option. */
  fits: boolean
}

export interface ExcludedItem {
  pantryItemId: string
  foodName: string
  reason: PantryExclusion
}

export interface PlannerResult {
  day: KcalRange
  meals: MealPlan[]
  /** Best combination of one option per meal (null when no meal has an option). */
  dayPlan: DayPlan | null
  excluded: ExcludedItem[]
}
