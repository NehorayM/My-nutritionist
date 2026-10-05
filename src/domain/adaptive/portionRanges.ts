import type { FoodCategory, FoodItem } from '@/types'
import { memoize } from './memo'

/* Realistic portion sizes of one component (app conventions for everyday plates). */

export interface GramRange {
  min: number
  max: number
}

/** Realistic grams of one component by category (app convention). */
export const PORTION_GRAMS: Readonly<Record<FoodCategory, GramRange>> = {
  protein: { min: 50, max: 200 },
  dairy: { min: 20, max: 300 },
  grain: { min: 20, max: 250 },
  legume: { min: 60, max: 250 },
  vegetable: { min: 40, max: 250 },
  fruit: { min: 50, max: 250 },
  fat: { min: 5, max: 15 },
  nut_seed: { min: 10, max: 40 },
  snack: { min: 15, max: 60 },
  sweet: { min: 10, max: 40 },
  fast_food: { min: 80, max: 350 },
  israeli: { min: 15, max: 300 },
  beverage: { min: 120, max: 360 },
  prepared: { min: 100, max: 400 },
}
const DEFAULT_PORTION: GramRange = { min: 20, max: 300 }

/** Share of the meal's energy a side takes by category; the anchor takes what is left. */
export const SIDE_ENERGY_SHARE: Readonly<Record<FoodCategory, number>> = {
  vegetable: 0.1,
  fruit: 0.15,
  grain: 0.3,
  legume: 0.25,
  fat: 0.12,
  nut_seed: 0.15,
  dairy: 0.2,
  israeli: 0.2,
  beverage: 0.12,
  protein: 0.3,
  snack: 0.15,
  sweet: 0.12,
  fast_food: 0.3,
  prepared: 0.3,
}
const DEFAULT_SIDE_SHARE = 0.2

/** A component is at most 2.5 × the food's largest household serving. */
const SERVING_MAX_MULTIPLE = 2.5

/**
 * Energy-dense foods within a category get a smaller cap: cheeses (≥ 250 kcal/100 g) 60 g, dry cereals and
 * granola (≥ 350) 80 g, dense dips and pastries (≥ 230) 150 g; anything ≥ 450 kcal/100 g 40 g.
 */
const DENSE_CAPS: Readonly<Partial<Record<FoodCategory, { kcalPer100g: number; maxGrams: number }>>> = {
  dairy: { kcalPer100g: 250, maxGrams: 60 },
  grain: { kcalPer100g: 350, maxGrams: 80 },
  israeli: { kcalPer100g: 230, maxGrams: 150 },
}
const VERY_DENSE = { kcalPer100g: 450, maxGrams: 40 } as const

function validServingGrams(food: FoodItem): number[] {
  return food.servings.map((serving) => serving.grams).filter((grams) => Number.isFinite(grams) && grams > 0)
}

/** Grams a single component of this food may weigh. */
export const portionRange = memoize((food: FoodItem): GramRange => {
  const base = food.category ? PORTION_GRAMS[food.category] : DEFAULT_PORTION
  let max = base.max
  const servings = validServingGrams(food)
  if (servings.length > 0) max = Math.min(max, Math.max(SERVING_MAX_MULTIPLE * Math.max(...servings), 2 * base.min))
  const kcal = food.per100g.calories ?? 0
  const dense = food.category ? DENSE_CAPS[food.category] : undefined
  if (dense && kcal >= dense.kcalPer100g) max = Math.min(max, dense.maxGrams)
  if (kcal >= VERY_DENSE.kcalPer100g) max = Math.min(max, VERY_DENSE.maxGrams)
  return { min: Math.min(base.min, max), max }
})

/** Share of a meal's energy this food takes as a side. */
export function sideShare(food: FoodItem): number {
  return food.category ? SIDE_ENERGY_SHARE[food.category] : DEFAULT_SIDE_SHARE
}
