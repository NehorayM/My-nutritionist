import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { nutrientProfile } from '@/domain/nutrients'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { getRepositories, setRepositories } from '@/services/runtime'
import type { FoodPortion, MealEntry } from '@/types'
import { useMealsStore } from './mealsStore'
import { portionAmountError, recentFoods, toPortion } from '@/domain/foodLog'
import { resetUserStores } from './registry'

const TODAY = '2026-10-07'
const YESTERDAY = '2026-10-06'

function portion(slug: string, grams: number, serving?: { label: string; grams: number; quantity: number }): FoodPortion {
  const food = systemFoodBySlug(slug)
  if (!food) throw new Error(`missing ${slug}`)
  return {
    foodId: food.id,
    foodSource: food.source,
    foodExternalId: food.externalId,
    foodName: food.name,
    brand: food.brand,
    quantity: serving ? serving.quantity : grams,
    servingLabel: serving?.label ?? null,
    servingGrams: serving?.grams ?? null,
    grams,
    per100g: { ...food.per100g },
  }
}

const store = () => useMealsStore.getState()

async function added(portions: FoodPortion[], mealType: MealEntry['mealType'], date: string): Promise<MealEntry[]> {
  const result = await store().addPortions(portions, mealType, date)
  if (!result.ok) throw new Error(result.message)
  return result.value
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 12, 30))
  await deleteDatabase()
  setRepositories(createLocalRepositories(newId()))
  resetUserStores()
})

afterEach(() => {
  setRepositories(null)
  vi.useRealTimers()
})

describe('portionAmountError', () => {
  it('rejects empty, zero, tiny and very large amounts with clear messages', () => {
    expect(portionAmountError(null, null)).toBe('Enter an amount.')
    expect(portionAmountError(0, null)).toBe('Enter an amount greater than 0.')
    expect(portionAmountError(0.05, null)).toMatch(/too small to log/)
    expect(portionAmountError(6000, null)).toMatch(/more than 5,000 g in one entry/)
    expect(portionAmountError(30, 200)).toMatch(/more than 5,000 g/)
    expect(portionAmountError(1.5, 240)).toBeNull()
    expect(portionAmountError(150, null)).toBeNull()
  })
})

describe('useMealsStore', () => {
  it('loads a day, logs several portions in order and keeps the snapshot', async () => {
    await store().load(TODAY)
    expect(store().days[TODAY]).toMatchObject({ status: 'ready', entries: [] })

    const created = await added([portion('rolled_oats', 40), portion('banana', 118, { label: '1 medium banana (118 g)', grams: 118, quantity: 1 })], 'breakfast', TODAY)
    expect(created.map((entry) => entry.foodName)).toEqual(['Rolled oats (dry)', 'Banana'])
    expect(store().days[TODAY]?.entries.map((entry) => entry.foodName)).toEqual(['Rolled oats (dry)', 'Banana'])

    const stored = await getRepositories().meals.listByDate(TODAY)
    expect(stored).toHaveLength(2)
    expect(stored.find((entry) => entry.foodName === 'Banana')).toMatchObject({ mealType: 'breakfast', grams: 118, servingGrams: 118 })
  })

  it('refuses invalid amounts and future dates without saving', async () => {
    const zero = await store().addPortions([{ ...portion('apple', 100), quantity: 0, grams: 0 }], 'snack', TODAY)
    expect(zero).toEqual({ ok: false, message: 'Enter an amount greater than 0.' })
    const huge = await store().addPortions([portion('apple', 6000)], 'snack', TODAY)
    expect(huge.ok).toBe(false)
    const future = await store().addPortions([portion('apple', 100)], 'snack', '2026-10-08')
    expect(future).toEqual({ ok: false, message: 'Meals can be logged for today or earlier days.' })
    expect(await getRepositories().meals.listRecent(10)).toEqual([])
  })

  it('updates the amount (recomputing grams from the serving) and moves meals', async () => {
    await store().load(TODAY)
    const [entry] = await added([portion('white_rice_cooked', 158, { label: '1 cup (158 g)', grams: 158, quantity: 1 })], 'lunch', TODAY)
    const result = await store().updateEntry(entry!.id, { quantity: 1.5, mealType: 'dinner' })
    expect(result.ok && result.value).toMatchObject({ quantity: 1.5, grams: 237, mealType: 'dinner', per100g: entry!.per100g })
    expect(store().days[TODAY]?.entries[0]).toMatchObject({ grams: 237, mealType: 'dinner' })

    const invalid = await store().updateEntry(entry!.id, { quantity: 40 })
    expect(invalid.ok).toBe(false)
    expect(store().days[TODAY]?.entries[0]?.quantity).toBe(1.5)
  })

  it('deletes an entry and restores it (undo)', async () => {
    await store().load(TODAY)
    const [entry] = await added([portion('apple', 182)], 'snack', TODAY)
    const removed = await store().deleteEntry(entry!.id)
    expect(removed.ok).toBe(true)
    expect(store().days[TODAY]?.entries).toEqual([])
    expect(await getRepositories().meals.listByDate(TODAY)).toEqual([])

    await store().restoreEntry(entry!)
    expect(store().days[TODAY]?.entries.map((e) => e.id)).toEqual([entry!.id])
    expect(await getRepositories().meals.listByDate(TODAY)).toHaveLength(1)
  })

  it('copies a meal from yesterday as new entries', async () => {
    await added([portion('greek_yogurt_plain', 200), portion('blueberries', 75)], 'breakfast', YESTERDAY)
    await added([portion('apple', 182)], 'snack', YESTERDAY)
    await store().load(TODAY)

    const copied = await store().copyMeal(YESTERDAY, TODAY, 'breakfast')
    expect(copied.ok && copied.value.map((entry) => [entry.foodName, entry.date, entry.mealType])).toEqual([
      ['Greek yogurt, plain, low-fat', TODAY, 'breakfast'],
      ['Blueberries', TODAY, 'breakfast'],
    ])
    const empty = await store().copyMeal(YESTERDAY, TODAY, 'dinner')
    expect(empty.ok).toBe(false)
  })

  it('derives recent foods: one per food, newest portion first', async () => {
    await added([portion('apple', 100)], 'snack', YESTERDAY)
    vi.setSystemTime(new Date(2026, 9, 7, 13, 0))
    await added([portion('apple', 182, { label: '1 medium apple (182 g)', grams: 182, quantity: 1 })], 'lunch', TODAY)
    const custom = { ...portion('banana', 50), foodId: null, foodSource: 'custom' as const, foodExternalId: null, foodName: 'Mom’s cake' }
    vi.setSystemTime(new Date(2026, 9, 7, 13, 5))
    await added([custom], 'dinner', TODAY)

    await store().loadRecent()
    const recent = recentFoods(store().recentEntries)
    expect(recent.map((food) => [food.portion.foodName, food.portion.grams])).toEqual([
      ['Mom’s cake', 50],
      ['Apple', 182],
    ])
    expect(recent[1]?.mealType).toBe('lunch')
  })

  it('treats a saved provider copy and the unsaved result as one recent food', () => {
    const base = { ...portion('apple', 100), foodSource: 'usda' as const, foodExternalId: '2345', foodName: 'Lentil soup' }
    const unsaved: MealEntry = { ...base, foodId: null, id: newId(), userId: newId(), date: TODAY, mealType: 'lunch', loggedAt: '2026-10-07T10:00:00.000Z', createdAt: '2026-10-07T10:00:00.000Z', updatedAt: '2026-10-07T10:00:00.000Z' }
    const saved: MealEntry = { ...unsaved, id: newId(), foodId: newId(), grams: 250, loggedAt: '2026-10-07T11:00:00.000Z' }
    expect(recentFoods([unsaved, saved]).map((food) => [food.key, food.portion.grams])).toEqual([['usda:2345', 250]])
  })

  it('never selects a future date and starts empty after a user switch', async () => {
    store().selectDate('2026-10-09')
    expect(store().selectedDate).toBeNull()
    store().selectDate(YESTERDAY)
    expect(store().selectedDate).toBe(YESTERDAY)
    await store().load(TODAY)
    resetUserStores()
    expect(store().selectedDate).toBeNull()
    expect(store().days).toEqual({})
  })

  it('reports a load failure as an error status', async () => {
    setRepositories(null)
    await store().load(TODAY)
    expect(store().days[TODAY]).toMatchObject({ status: 'error', error: "Couldn't load your meals. Please try again." })
  })

  it('keeps only portion fields when copying an entry', () => {
    const entry = { ...portion('apple', 10), per100g: nutrientProfile({ calories: 52 }), id: 'x', extra: true }
    expect(Object.keys(toPortion(entry))).not.toContain('id')
  })
})
