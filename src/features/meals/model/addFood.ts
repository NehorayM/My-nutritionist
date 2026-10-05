import type { FoodItem, FoodPortion } from '@/types'

export const ADD_FOOD_TABS = ['search', 'recent', 'favorites', 'saved', 'custom'] as const
export type AddFoodTab = (typeof ADD_FOOD_TABS)[number]

export const ADD_FOOD_TAB_LABELS: Record<AddFoodTab, string> = {
  search: 'Search',
  recent: 'Recent',
  favorites: 'Favorites',
  saved: 'Saved meals',
  custom: 'Custom',
}

export function isAddFoodTab(value: string): value is AddFoodTab {
  return (ADD_FOOD_TABS as readonly string[]).includes(value)
}

/** The food open in the detail view, optionally prefilled with a portion (Recent: the last amount logged). */
export interface FoodSelection {
  food: FoodItem
  portion: FoodPortion | null
}
