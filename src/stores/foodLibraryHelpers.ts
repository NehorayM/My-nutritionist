import { systemFoodById } from '@/data/systemFoods'
import { isUnsavedProviderFood } from '@/services/food'
import type { Favorite, FoodItem } from '@/types'

/** Pure helpers for favorites and saved provider foods (used by the food library store and the Meals UI). */

export const newestFirst = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt)
const sameProviderRecord = (a: FoodItem, b: FoodItem) => a.source === b.source && a.externalId !== null && a.externalId === b.externalId

/** The user's saved copy of a provider result, if they saved it before. */
export function savedCopyOf(food: FoodItem, userFoods: readonly FoodItem[]): FoodItem | null {
  if (!isUnsavedProviderFood(food)) return userFoods.find((own) => own.id === food.id) ?? null
  return userFoods.find((own) => own.createdBy !== null && sameProviderRecord(own, food)) ?? null
}

/** The favorite record for a food (also for an unsaved provider result whose saved copy is a favorite). */
export function favoriteFor(food: FoodItem, favorites: readonly Favorite[], userFoods: readonly FoodItem[]): Favorite | null {
  const id = isUnsavedProviderFood(food) ? savedCopyOf(food, userFoods)?.id : food.id
  return id === undefined ? null : (favorites.find((favorite) => favorite.foodId === id) ?? null)
}

/** Favorites resolved to foods (system catalog or the user's own foods), newest first; dangling ones are skipped. */
export function resolveFavoriteFoods(favorites: readonly Favorite[], userFoods: readonly FoodItem[]): FoodItem[] {
  const own = new Map(userFoods.map((food) => [food.id, food]))
  return [...favorites]
    .sort(newestFirst)
    .map((favorite) => own.get(favorite.foodId) ?? systemFoodById(favorite.foodId))
    .filter((food): food is FoodItem => food !== undefined)
}
