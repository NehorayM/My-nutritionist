import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { nutrientProfile } from '@/domain/nutrients'
import { deleteDatabase } from '@/lib/idb'
import { favoriteId, newId, userFoodId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { providerFoodId } from '@/services/food'
import { getRepositories, setRepositories } from '@/services/runtime'
import type { FoodItem, FoodPortion } from '@/types'
import { favoriteFor, useFavoriteFoods, useFoodLibraryStore, type CustomFoodInput } from './foodLibraryStore'
import { resetUserStores } from './registry'
import { renderHook } from '@testing-library/react'

const store = () => useFoodLibraryStore.getState()

const BAR: CustomFoodInput = {
  name: '  Oat bar ',
  brand: '',
  servings: [{ label: '1 bar', grams: 40 }],
  per100g: nutrientProfile({ calories: 400, protein: 10, carbs: 60, fat: 12 }),
  allergens: null,
  dietFlags: { vegetarian: true, vegan: null },
}

async function unsavedUsdaFood(): Promise<FoodItem> {
  const stamp = new Date().toISOString()
  return {
    id: await providerFoodId('usda', '2345'),
    source: 'usda',
    externalId: '2345',
    name: 'Lentil soup',
    brand: null,
    barcode: null,
    category: null,
    per100g: nutrientProfile({ calories: 60, protein: 4, carbs: 9, fat: 1 }),
    servings: [{ label: '1 cup', grams: 245 }],
    allergens: null,
    dietFlags: { vegetarian: null, vegan: null },
    tags: [],
    mealTypes: [],
    prepMinutes: null,
    requiresCooking: null,
    costTier: null,
    attribution: 'USDA FoodData Central',
    createdBy: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(createLocalRepositories(newId()))
  resetUserStores()
  await store().load()
})

afterEach(() => {
  setRepositories(null)
})

describe('useFoodLibraryStore', () => {
  it('creates, updates and deletes a custom food (with undo)', async () => {
    const created = await store().createCustomFood(BAR)
    if (!created.ok) throw new Error(created.message)
    expect(created.value).toMatchObject({ name: 'Oat bar', brand: null, source: 'custom', createdBy: getRepositories().userId })
    expect(await getRepositories().foods.list()).toHaveLength(1)

    const updated = await store().updateCustomFood(created.value.id, { ...BAR, name: 'Oat bar (choc)' })
    expect(updated.ok && updated.value.name).toBe('Oat bar (choc)')

    await store().toggleFavorite(created.value)
    const removed = await store().deleteCustomFood(created.value.id)
    if (!removed.ok) throw new Error(removed.message)
    expect(removed.value.favorite?.foodId).toBe(created.value.id)
    expect(store().userFoods).toEqual([])
    expect(store().favorites).toEqual([])

    await store().restoreCustomFood(removed.value)
    expect(store().userFoods.map((food) => food.name)).toEqual(['Oat bar (choc)'])
    expect(store().favorites).toHaveLength(1)
  })

  it('rejects invalid custom foods', async () => {
    const result = await store().createCustomFood({ ...BAR, per100g: nutrientProfile({ calories: 1500, protein: 0, carbs: 0, fat: 0 }) })
    expect(result.ok).toBe(false)
    expect(await getRepositories().foods.list()).toEqual([])
  })

  it('favorites a catalog food idempotently and toggles it off', async () => {
    const oats = systemFoodBySlug('rolled_oats')!
    expect(await store().toggleFavorite(oats)).toEqual({ ok: true, value: true })
    const [favorite] = await getRepositories().favorites.list()
    expect(favorite).toMatchObject({ foodId: oats.id, id: await favoriteId(getRepositories().userId, oats.id) })

    const { result } = renderHook(() => useFavoriteFoods())
    expect(result.current.map((food) => food.name)).toEqual(['Rolled oats (dry)'])

    expect(await store().toggleFavorite(oats)).toEqual({ ok: true, value: false })
    expect(await getRepositories().favorites.list()).toEqual([])
  })

  it('saves an unsaved provider result before favoriting it, once', async () => {
    const soup = await unsavedUsdaFood()
    await store().toggleFavorite(soup)
    const userId = getRepositories().userId
    const savedId = await userFoodId(userId, 'usda', '2345')
    expect(store().userFoods.map((food) => [food.id, food.createdBy])).toEqual([[savedId, userId]])
    expect(store().favorites.map((favorite) => favorite.foodId)).toEqual([savedId])
    expect(favoriteFor(soup, store().favorites, store().userFoods)?.foodId).toBe(savedId)

    // Toggling the same search result again removes the favorite but keeps the saved copy.
    await store().toggleFavorite(soup)
    expect(store().favorites).toEqual([])
    await store().toggleFavorite(soup)
    expect(await getRepositories().foods.list()).toHaveLength(1)
    expect(await getRepositories().favorites.list()).toHaveLength(1)
  })

  it('saves, deletes and restores a meal template', async () => {
    const apple = systemFoodBySlug('apple')!
    const item: FoodPortion = {
      foodId: apple.id,
      foodSource: 'system',
      foodExternalId: apple.externalId,
      foodName: apple.name,
      brand: null,
      quantity: 1,
      servingLabel: '1 medium apple (182 g)',
      servingGrams: 182,
      grams: 182,
      per100g: { ...apple.per100g },
    }
    expect((await store().saveMeal('  ', [item], 'snack')).ok).toBe(false)
    const saved = await store().saveMeal('Afternoon snack', [{ ...item, id: 'extra' } as FoodPortion], 'snack')
    if (!saved.ok) throw new Error(saved.message)
    expect(Object.keys(saved.value.items[0]!)).not.toContain('id')
    expect(await getRepositories().savedMeals.list()).toHaveLength(1)

    const removed = await store().deleteSavedMeal(saved.value.id)
    expect(removed.ok).toBe(true)
    expect(await getRepositories().savedMeals.list()).toEqual([])
    await store().restoreSavedMeal(saved.value)
    expect(store().savedMeals.map((meal) => meal.name)).toEqual(['Afternoon snack'])
  })

  it('reports load failures', async () => {
    resetUserStores()
    setRepositories(null)
    await store().load()
    expect(store().status).toBe('error')
  })
})
