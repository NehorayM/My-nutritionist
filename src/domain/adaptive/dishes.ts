import type { FoodItem, MealType } from '@/types'
import { normalizeName } from './context'
import { shortName } from './explanations'
import { memoize } from './memo'
import { compareIds } from './order'

/*
 * Display identity of foods and options. Two foods that read the same on a card ("Hummus" and a saved
 * "Hummus (homemade)") are the same dish: one option never lists a dish twice, and two options that read the
 * same are one option — whichever food ids sit behind them.
 */

/** Separator of food ids in option ids and of dish names in signatures. */
export const ID_SEPARATOR = '+'

/** The food's short display name, lower-cased ("Brown rice, cooked" → "brown rice"). */
export const dishName = memoize((food: Pick<FoodItem, 'name'>): string => normalizeName(shortName(food)))

/** What an option reads like: its dish names, sorted. Options with equal signatures look identical. */
export function dishSignature(foods: readonly Pick<FoodItem, 'name'>[]): string {
  return foods.map(dishName).sort(compareIds).join(ID_SEPARATOR)
}

/** Option id: `style:mealType:foodIds` with the food ids sorted and joined by "+". */
export function optionId(style: string, mealType: MealType, foodIds: readonly string[]): string {
  return `${style}:${mealType}:${[...foodIds].sort(compareIds).join(ID_SEPARATOR)}`
}

/**
 * Signatures of the options dismissed for `mealType`, so a dismissed option does not return under another
 * style or with a same-named food. Ids for other meals, malformed ids and ids naming a food that is not in
 * `foods` are skipped (those still match by exact id).
 */
export function dismissedSignatures(dismissedIds: Iterable<string>, foods: readonly FoodItem[], mealType: MealType): Set<string> {
  const byId = new Map(foods.map((food) => [food.id, food]))
  const signatures = new Set<string>()
  const prefix = `:${mealType}:`
  for (const id of dismissedIds) {
    const at = id.indexOf(prefix)
    if (at <= 0) continue
    const named = id
      .slice(at + prefix.length)
      .split(ID_SEPARATOR)
      .map((foodId) => byId.get(foodId))
    if (named.some((food) => food === undefined)) continue
    signatures.add(dishSignature(named.filter((food): food is FoodItem => food !== undefined)))
  }
  return signatures
}
