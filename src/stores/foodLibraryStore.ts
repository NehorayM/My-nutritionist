import { useMemo } from 'react'
import { create } from 'zustand'
import { systemFoodById } from '@/data/systemFoods'
import { favoriteId, newId } from '@/lib/id'
import { favoriteSchema, foodItemSchema, savedMealSchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import { isUnsavedProviderFood, toSavedProviderFood } from '@/services/food'
import type { Favorite, FoodItem, FoodPortion, MealType, SavedMeal } from '@/types'
import { userMessageFor } from './errors'
import type { LoadStatus, SaveResult } from './profileStore'
import { toPortion } from './mealsStore'
import { registerUserStoreReset } from './registry'

/** What the user enters for a custom food (everything else is filled in by the store). */
export type CustomFoodInput = Pick<FoodItem, 'name' | 'brand' | 'servings' | 'per100g' | 'allergens' | 'dietFlags'>
export type LibraryResult<T> = { ok: true; value: T } | { ok: false; message: string }
export interface RemovedCustomFood {
  food: FoodItem
  favorite: Favorite | null
}

const fail = (message: string) => ({ ok: false, message }) as const
const newestFirst = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt)
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

interface FoodLibraryState {
  /** Custom foods and saved provider foods. */
  userFoods: FoodItem[]
  favorites: Favorite[]
  savedMeals: SavedMeal[]
  status: LoadStatus
  error: string | null
  load: (options?: { force?: boolean }) => Promise<void>
  createCustomFood: (input: CustomFoodInput) => Promise<LibraryResult<FoodItem>>
  updateCustomFood: (id: string, input: CustomFoodInput) => Promise<LibraryResult<FoodItem>>
  /** Logged entries keep their nutrition snapshot; the food's favorite is removed with it. */
  deleteCustomFood: (id: string) => Promise<LibraryResult<RemovedCustomFood>>
  restoreCustomFood: (removed: RemovedCustomFood) => Promise<SaveResult>
  /** Unsaved provider results are saved as user foods first. Returns whether the food is now a favorite. */
  toggleFavorite: (food: FoodItem) => Promise<LibraryResult<boolean>>
  saveMeal: (name: string, items: readonly FoodPortion[], mealType: MealType | null) => Promise<LibraryResult<SavedMeal>>
  deleteSavedMeal: (id: string) => Promise<LibraryResult<SavedMeal>>
  restoreSavedMeal: (meal: SavedMeal) => Promise<SaveResult>
  reset: () => void
}

const initial = { userFoods: [], favorites: [], savedMeals: [], status: 'idle' as LoadStatus, error: null }
let generation = 0

type ListKey = 'userFoods' | 'favorites' | 'savedMeals'
type Item = FoodItem | Favorite | SavedMeal

export const useFoodLibraryStore = create<FoodLibraryState>()((set, get) => {
  /** Replaces the record with `id` in a list (removing it when `item` is null). */
  function put<K extends ListKey>(key: K, id: string, item: FoodLibraryState[K][number] | null): void {
    set((state) => {
      const rest = (state[key] as Item[]).filter((existing) => existing.id !== id)
      return { [key]: (item ? [...rest, item] : rest).sort(newestFirst) } as Pick<FoodLibraryState, K>
    })
  }

  async function save<K extends ListKey>(key: K, item: FoodLibraryState[K][number], action: string): Promise<LibraryResult<typeof item>> {
    const before = (get()[key] as Item[]).find((existing) => existing.id === item.id) ?? null
    put(key, item.id, item)
    try {
      const repos = getRepositories()
      const saved =
        key === 'userFoods' ? await repos.foods.save(item as FoodItem)
        : key === 'favorites' ? await repos.favorites.save(item as Favorite)
        : await repos.savedMeals.save(item as SavedMeal)
      put(key, saved.id, saved as typeof item)
      return { ok: true, value: saved as typeof item }
    } catch (error) {
      put(key, item.id, before as typeof item | null)
      return fail(userMessageFor(error, action))
    }
  }

  async function remove<K extends ListKey>(key: K, id: string, action: string): Promise<SaveResult> {
    const before = (get()[key] as Item[]).find((existing) => existing.id === id)
    if (!before) return { ok: true }
    put(key, id, null)
    try {
      const repos = getRepositories()
      await (key === 'userFoods' ? repos.foods : key === 'favorites' ? repos.favorites : repos.savedMeals).remove(id)
      return { ok: true }
    } catch (error) {
      put(key, id, before as FoodLibraryState[K][number])
      return fail(userMessageFor(error, action))
    }
  }

  function customFood(input: CustomFoodInput, base: Pick<FoodItem, 'id' | 'createdAt'>): FoodItem {
    const now = new Date().toISOString()
    const brand = input.brand?.trim() || null
    return {
      ...base,
      ...input,
      name: input.name.trim(),
      brand,
      source: 'custom',
      externalId: null,
      barcode: null,
      category: null,
      tags: [],
      mealTypes: [],
      prepMinutes: null,
      requiresCooking: null,
      costTier: null,
      attribution: null,
      createdBy: getRepositories().userId,
      updatedAt: now,
    }
  }

  function saveCustomFood(food: FoodItem, action: string): Promise<LibraryResult<FoodItem>> {
    if (!foodItemSchema.safeParse(food).success) return Promise.resolve(fail('Please check the food details and nutrition values.'))
    return save('userFoods', food, action)
  }

  return {
    ...initial,

    async load(options = {}) {
      const { status } = get()
      if (!options.force && (status === 'ready' || status === 'loading')) return
      const run = generation
      set({ status: 'loading', error: null })
      try {
        const repos = getRepositories()
        const [userFoods, favorites, savedMeals] = await Promise.all([repos.foods.list(), repos.favorites.list(), repos.savedMeals.list()])
        if (run !== generation) return
        set({ userFoods: userFoods.sort(newestFirst), favorites: favorites.sort(newestFirst), savedMeals: savedMeals.sort(newestFirst), status: 'ready' })
      } catch (error) {
        if (run === generation) set({ status: 'error', error: userMessageFor(error, 'load your foods') })
      }
    },

    createCustomFood(input) {
      return saveCustomFood(customFood(input, { id: newId(), createdAt: new Date().toISOString() }), 'save the food')
    },

    async updateCustomFood(id, input) {
      const existing = get().userFoods.find((food) => food.id === id && food.source === 'custom')
      if (!existing) return fail('This food is no longer available.')
      return saveCustomFood(customFood(input, existing), 'update the food')
    },

    async deleteCustomFood(id) {
      const food = get().userFoods.find((existing) => existing.id === id)
      if (!food) return fail('This food is no longer available.')
      const favorite = get().favorites.find((existing) => existing.foodId === id) ?? null
      if (favorite) {
        const unfavorited = await remove('favorites', favorite.id, 'delete the food')
        if (!unfavorited.ok) return unfavorited
      }
      const removed = await remove('userFoods', id, 'delete the food')
      if (!removed.ok) {
        if (favorite) await save('favorites', favorite, 'delete the food')
        return removed
      }
      return { ok: true, value: { food, favorite } }
    },

    async restoreCustomFood({ food, favorite }) {
      const restored = await save('userFoods', { ...food, updatedAt: new Date().toISOString() }, 'restore the food')
      if (!restored.ok || !favorite) return restored.ok ? { ok: true } : restored
      const linked = await save('favorites', { ...favorite, updatedAt: new Date().toISOString() }, 'restore the food')
      return linked.ok ? { ok: true } : linked
    },

    async toggleFavorite(food) {
      const { favorites, userFoods } = get()
      const existing = favoriteFor(food, favorites, userFoods)
      if (existing) {
        const removed = await remove('favorites', existing.id, 'update your favorites')
        return removed.ok ? { ok: true, value: false } : removed
      }
      const { userId } = getRepositories()
      const now = new Date().toISOString()
      let target = food
      if (isUnsavedProviderFood(food)) {
        const copy = savedCopyOf(food, userFoods)
        if (copy) target = copy
        else {
          const saved = await save('userFoods', await toSavedProviderFood(food, userId, now), 'save the food')
          if (!saved.ok) return saved
          target = saved.value
        }
      }
      const favorite: Favorite = { id: await favoriteId(userId, target.id), userId, foodId: target.id, createdAt: now, updatedAt: now }
      if (!favoriteSchema.safeParse(favorite).success) return fail('This food can’t be added to favorites.')
      const saved = await save('favorites', favorite, 'update your favorites')
      return saved.ok ? { ok: true, value: true } : saved
    },

    async saveMeal(name, items, mealType) {
      const now = new Date().toISOString()
      const meal: SavedMeal = { id: newId(), userId: getRepositories().userId, name: name.trim(), mealType, items: items.map(toPortion), createdAt: now, updatedAt: now }
      if (!savedMealSchema.safeParse(meal).success) {
        return fail(meal.name.length === 0 ? 'Give the meal a name.' : 'This meal can’t be saved. Check its name and foods.')
      }
      return save('savedMeals', meal, 'save the meal')
    },

    async deleteSavedMeal(id) {
      const meal = get().savedMeals.find((existing) => existing.id === id)
      if (!meal) return fail('This meal is no longer available.')
      const removed = await remove('savedMeals', id, 'delete the meal')
      return removed.ok ? { ok: true, value: meal } : removed
    },

    async restoreSavedMeal(meal) {
      const restored = await save('savedMeals', { ...meal, updatedAt: new Date().toISOString() }, 'restore the meal')
      return restored.ok ? { ok: true } : restored
    },

    reset() {
      generation += 1
      set(initial)
    },
  }
})

registerUserStoreReset(() => useFoodLibraryStore.getState().reset())

/** Favorite foods (memoized), newest favorite first. */
export function useFavoriteFoods(): FoodItem[] {
  const favorites = useFoodLibraryStore((s) => s.favorites)
  const userFoods = useFoodLibraryStore((s) => s.userFoods)
  return useMemo(() => resolveFavoriteFoods(favorites, userFoods), [favorites, userFoods])
}
