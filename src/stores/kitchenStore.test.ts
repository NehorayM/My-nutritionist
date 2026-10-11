import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { getRepositories, setRepositories } from '@/services/runtime'
import { useKitchenStore, type PantryInput } from './kitchenStore'
import { resetUserStores } from './registry'

const store = () => useKitchenStore.getState()

function input(slug: string, grams: number | null = 400): PantryInput {
  const food = systemFoodBySlug(slug)
  if (!food) throw new Error(slug)
  return { food, grams, servingLabel: null, servingGrams: null, prep: 'ready', cookMinutes: null, methods: [], useBy: null }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 9, 0))
  await deleteDatabase()
  setRepositories(createLocalRepositories(newId()))
  resetUserStores()
  await store().load()
})

afterEach(() => {
  setRepositories(null)
  vi.useRealTimers()
})

describe('kitchen store', () => {
  it('starts with default planner settings and an empty pantry', () => {
    expect(store()).toMatchObject({ status: 'ready', pantry: [] })
    expect(store().settings?.meals.dinner.maxMinutes).toBe(45)
  })

  it('adds, updates and removes items, persisting them', async () => {
    const added = await store().addItem(input('banana'))
    if (!added.ok) throw new Error(added.message)
    expect(await getRepositories().pantry.list()).toHaveLength(1)
    const updated = await store().updateItem(added.value.id, { ...input('banana'), grams: 200 })
    expect(updated.ok && updated.value.grams).toBe(200)
    const removed = await store().removeItem(added.value.id)
    expect(removed.ok).toBe(true)
    expect(await getRepositories().pantry.list()).toEqual([])
    if (removed.ok) await store().restoreItem(removed.value)
    expect(store().pantry).toHaveLength(1)
  })

  it('rejects invalid items without saving', async () => {
    const result = await store().addItem({ ...input('banana'), prep: 'cook', cookMinutes: null, methods: ['stove'] })
    expect(result.ok).toBe(false)
    expect(await getRepositories().pantry.list()).toEqual([])
  })

  it('takes eaten amounts out and removes what is used up', async () => {
    const rice = await store().addItem(input('white_rice_cooked', 400))
    const egg = await store().addItem(input('egg_hard_boiled', 50))
    const some = await store().addItem(input('tomato', null))
    if (!rice.ok || !egg.ok || !some.ok) throw new Error('add failed')
    expect(await store().consume({ [rice.value.id]: 150, [egg.value.id]: 48, [some.value.id]: 100 })).toEqual({ ok: true })
    const left = Object.fromEntries(store().pantry.map((item) => [item.food.name, item.grams]))
    expect(left).toEqual({ 'White rice, cooked': 250, Tomato: null })
  })

  it('saves planner settings and keeps them after a reload', async () => {
    const settings = store().settings
    if (!settings) throw new Error('no settings')
    expect(await store().saveSettings({ ...settings, dailyKcalMin: 1500, dailyKcalMax: 1800 })).toEqual({ ok: true })
    resetUserStores()
    await store().load()
    expect(store().settings).toMatchObject({ dailyKcalMin: 1500, dailyKcalMax: 1800 })
    expect((await store().saveSettings({ ...settings, dailyKcalMin: 1900, dailyKcalMax: 1800 })).ok).toBe(false)
  })
})
