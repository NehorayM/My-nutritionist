import type { FoodSource } from './food'
import type { NutrientProfile } from './nutrition'

/**
 * Meal slots. Stored as plain text in the database (no enum/check constraint)
 * so slots can become user-customizable later without a schema migration.
 */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export interface MealSlot {
  key: MealType
  label: string
  /** Typical local start hour, used for "remaining meals" and meal timing. */
  startsAtHour: number
}

/**
 * A concrete amount of a food, with a nutrition SNAPSHOT so historical entries stay
 * meaningful even if the source food later changes or disappears.
 */
export interface FoodPortion {
  /** Persisted food id (system or user food); null for unsaved provider results. */
  foodId: string | null
  foodSource: FoodSource
  foodExternalId: string | null
  foodName: string
  brand: string | null
  /** Number of serving units (e.g. 1.5 × "1 cup"). When unit is grams, quantity === grams. */
  quantity: number
  /** Label of the serving unit used; null means grams. */
  servingLabel: string | null
  /** Grams per serving unit; null means the unit is grams. */
  servingGrams: number | null
  /** Total grams eaten = quantity × (servingGrams ?? 1). */
  grams: number
  /** Snapshot of nutrients per 100 g at logging time. */
  per100g: NutrientProfile
}

export interface MealEntry extends FoodPortion {
  id: string
  userId: string
  /** Local calendar date YYYY-MM-DD the food belongs to. */
  date: string
  mealType: MealType
  /** ISO timestamp of when the entry was logged. */
  loggedAt: string
  createdAt: string
  updatedAt: string
}

/** Saved meal template (e.g. a saved recommendation) that can be logged in one action. */
export interface SavedMeal {
  id: string
  userId: string
  name: string
  mealType: MealType | null
  items: FoodPortion[]
  createdAt: string
  updatedAt: string
}

export interface Favorite {
  id: string
  userId: string
  foodId: string
  createdAt: string
  updatedAt: string
}
