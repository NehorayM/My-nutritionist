import type { FoodItem } from './food'
import type { MealType } from './meal'

/** Heating equipment that can be available at a meal. */
export const KITCHEN_EQUIPMENT = ['microwave', 'stove', 'oven'] as const
export type KitchenEquipment = (typeof KITCHEN_EQUIPMENT)[number]

/** How a pantry item is eaten: as is, warmed up (e.g. leftovers), or cooked from raw. */
export const PANTRY_PREP = ['ready', 'reheat', 'cook'] as const
export type PantryPrep = (typeof PANTRY_PREP)[number]

/** Something the user has at home (fridge, freezer or pantry). */
export interface PantryItem {
  id: string
  userId: string
  /** Snapshot of the food (catalog, own or provider food), so planning works offline. */
  food: FoodItem
  /** Grams available; null = "some" (the amount is not tracked). */
  grams: number | null
  /** Unit the amount was entered in (display only); null = grams. */
  servingLabel: string | null
  servingGrams: number | null
  prep: PantryPrep
  /** Minutes to cook from raw; set exactly when `prep` is 'cook'. */
  cookMinutes: number | null
  /** Equipment that can warm or cook it; empty only for 'ready'. */
  methods: KitchenEquipment[]
  /** Local date (YYYY-MM-DD) to use it by; null = unknown. */
  useBy: string | null
  createdAt: string
  updatedAt: string
}

/** What is possible at one meal. */
export interface MealConstraint {
  /** Include this meal in plans. */
  enabled: boolean
  /** Equipment at this meal (used when equipment is set per meal). */
  equipment: KitchenEquipment[]
  /** Cooking raw ingredients is possible (otherwise only ready-to-eat or reheated items). */
  canCook: boolean
  /** Time available to prepare the meal, in minutes (0 = ready-to-eat only). */
  maxMinutes: number
  /** Calorie range of this meal; null = derived from the daily target. */
  kcalMin: number | null
  kcalMax: number | null
}

/** Meal-planner constraints (one record per user, keyed by the user like the profile). */
export interface PlannerSettings {
  userId: string
  /** 'day': `dayEquipment` applies to every meal; 'meal': each meal lists its own equipment. */
  equipmentScope: 'day' | 'meal'
  dayEquipment: KitchenEquipment[]
  /** Daily calorie range; null = derived from the nutrition targets. */
  dailyKcalMin: number | null
  dailyKcalMax: number | null
  meals: Record<MealType, MealConstraint>
  createdAt: string
  updatedAt: string
}
