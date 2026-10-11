import type { FoodItem } from '@/types'

/**
 * Part a food plays on a plate. `dish` = a complete dish (shakshuka, shawarma, pizza…), `protein` covers
 * protein-rich dairy and legumes too (by energy share), `extra` = snacks and sweets.
 */
export const PLATE_ROLES = ['protein', 'carb', 'veg', 'fruit', 'dairy', 'fat', 'dish', 'drink', 'extra'] as const
export type PlateRole = (typeof PLATE_ROLES)[number]

/** Protein supplying at least this share of a food's energy makes it the plate's protein. */
const PROTEIN_ROLE_SHARE = 0.3

export function proteinShare(food: FoodItem): number {
  const kcal = food.per100g.calories ?? 0
  const protein = food.per100g.protein ?? 0
  return kcal > 0 ? Math.min(1, (protein * 4) / kcal) : 0
}

export function plateRole(food: FoodItem): PlateRole {
  switch (food.category) {
    case 'protein':
    case 'legume':
      return 'protein'
    case 'grain':
      return 'carb'
    case 'vegetable':
      return proteinShare(food) >= PROTEIN_ROLE_SHARE ? 'protein' : (food.per100g.calories ?? 0) >= 60 ? 'carb' : 'veg'
    case 'fruit':
      return 'fruit'
    case 'dairy':
      return proteinShare(food) >= PROTEIN_ROLE_SHARE ? 'protein' : 'dairy'
    case 'fat':
    case 'nut_seed':
      return 'fat'
    case 'israeli':
    case 'prepared':
    case 'fast_food':
      return (food.per100g.calories ?? 0) >= 120 || food.servings.some((s) => s.grams >= 150) ? 'dish' : 'fat'
    case 'beverage':
      return 'drink'
    case 'snack':
    case 'sweet':
      return 'extra'
    case null:
      return proteinShare(food) >= PROTEIN_ROLE_SHARE ? 'protein' : 'extra'
  }
}

/** Energy share a role takes in a meal before portions are balanced. */
export const ROLE_ENERGY_SHARE: Readonly<Record<PlateRole, number>> = {
  protein: 0.35,
  carb: 0.3,
  dish: 0.6,
  dairy: 0.25,
  fruit: 0.15,
  veg: 0.1,
  fat: 0.12,
  drink: 0.1,
  extra: 0.15,
}
