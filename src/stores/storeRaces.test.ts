import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { RepositoryError, type Repositories } from '@/repositories/types'
import { setRepositories } from '@/services/runtime'
import type { FoodPortion } from '@/types'
import { useActivityStore } from './activityStore'
import { useFoodLibraryStore } from './foodLibraryStore'
import { useMealsStore } from './mealsStore'
import { useProfileStore } from './profileStore'
import { resetUserStores } from './registry'
import { useWeightStore, type WeighInInput } from './weightStore'

/**
 * Races between a slow repository read and local changes / session switches. Each test holds a read
 * at a gate AFTER it has read the database (so its result is stale), changes data, then opens the gate.
 */
const TODAY = '2026-10-07'

interface Gate {
  wait: () => Promise<void>
  open: () => void
}

function gate(): Gate {
  let release = () => undefined as void
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait: () => opened, open: () => release() }
}

/** Local repositories whose listed reads resolve only when `held` opens. */
function slowReads(userId: string, held: Gate): Repositories {
  const base = createLocalRepositories(userId)
  const later = <T>(read: () => Promise<T>) => async () => {
    const result = await read()
    await held.wait()
    return result
  }
  return {
    ...base,
    profile: { ...base.profile, get: later(() => base.profile.get()) },
    meals: { ...base.meals, listByDate: (date) => later(() => base.meals.listByDate(date))() },
    weights: { ...base.weights, list: later(() => base.weights.list()) },
    workouts: { ...base.workouts, listRange: (range) => later(() => base.workouts.listRange(range))() },
    foods: { ...base.foods, list: later(() => base.foods.list()) },
  }
}

const portion = (): FoodPortion => {
  const food = systemFoodBySlug('banana')
  if (!food) throw new Error('missing banana')
  return { foodId: food.id, foodSource: 'system', foodExternalId: food.externalId, foodName: food.name, brand: null, quantity: 118, servingLabel: null, servingGrams: null, grams: 118, per100g: { ...food.per100g } }
}

const weighIn = (weightKg: number): WeighInInput => ({ weightKg, inputUnit: 'kg', date: TODAY, measuredAt: '2026-10-07T07:00:00.000Z', note: null })

let userId: string

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 12, 0))
  await deleteDatabase()
  userId = newId()
  resetUserStores()
})

afterEach(() => {
  setRepositories(null)
  vi.useRealTimers()
})

describe('a load that finishes after a local change keeps the change', () => {
  it('meals: an entry added while the day loads stays on screen', async () => {
    const held = gate()
    setRepositories(slowReads(userId, held))
    const loading = useMealsStore.getState().load(TODAY)
    await vi.waitFor(() => expect(useMealsStore.getState().days[TODAY]?.status).toBe('loading'))
    const added = await useMealsStore.getState().addPortions([portion()], 'snack', TODAY)
    expect(added.ok).toBe(true)
    held.open()
    await loading
    expect(useMealsStore.getState().days[TODAY]).toMatchObject({ status: 'ready', entries: [{ foodName: 'Banana' }] })
  })

  it('meals: an entry deleted while the day loads stays deleted', async () => {
    setRepositories(createLocalRepositories(userId))
    const added = await useMealsStore.getState().addPortions([portion()], 'snack', TODAY)
    if (!added.ok) throw new Error(added.message)
    const held = gate()
    setRepositories(slowReads(userId, held))
    const loading = useMealsStore.getState().load(TODAY, { force: true })
    await useMealsStore.getState().deleteEntry(added.value[0]?.id ?? '')
    held.open()
    await loading
    expect(useMealsStore.getState().days[TODAY]?.entries).toEqual([])
  })

  it('weights: a weigh-in added during the load is kept', async () => {
    const held = gate()
    setRepositories(slowReads(userId, held))
    const loading = useWeightStore.getState().load()
    await useWeightStore.getState().add(weighIn(70))
    held.open()
    await loading
    expect(useWeightStore.getState().entries.map((e) => e.weightKg)).toEqual([70])
  })

  it('profile: a save made during the load is not replaced by the older copy', async () => {
    const held = gate()
    setRepositories(slowReads(userId, held))
    useProfileStore.setState({ profile: (await import('@/domain/profile')).createDefaultProfile(userId, '2026-10-07T09:00:00.000Z') })
    const loading = useProfileStore.getState().load()
    const base = useProfileStore.getState().profile
    if (!base) throw new Error('no profile')
    await useProfileStore.getState().save({ ...base, displayName: 'Dana' })
    held.open()
    await loading
    expect(useProfileStore.getState().profile?.displayName).toBe('Dana')
    expect(useProfileStore.getState().status).toBe('ready')
  })

  it('activity: a workout logged during the load is kept', async () => {
    const held = gate()
    setRepositories(slowReads(userId, held))
    const loading = useActivityStore.getState().load(TODAY, 1)
    const logged = await useActivityStore.getState().logWorkout({ date: TODAY, type: 'walk', durationMin: 30, intensity: 'light', kcal: null, notes: null, weightKg: null })
    expect(logged.ok).toBe(true)
    held.open()
    await loading
    expect(useActivityStore.getState().workouts.map((w) => w.type)).toEqual(['walk'])
  })

  it('food library: a custom food created during the load is kept', async () => {
    const held = gate()
    const repos = slowReads(userId, held)
    setRepositories({ ...repos, favorites: { ...repos.favorites, list: async () => [] }, savedMeals: { ...repos.savedMeals, list: async () => [] } })
    const loading = useFoodLibraryStore.getState().load()
    const food = systemFoodBySlug('hummus')
    if (!food) throw new Error('missing hummus')
    const created = await useFoodLibraryStore.getState().createCustomFood({ name: 'Grandma hummus', brand: null, servings: [], per100g: { ...food.per100g }, allergens: [], dietFlags: { vegetarian: true, vegan: true } })
    expect(created.ok).toBe(true)
    held.open()
    await loading
    expect(useFoodLibraryStore.getState().userFoods.map((f) => f.name)).toEqual(['Grandma hummus'])
  })
})

describe('results of a previous session never reach the next one', () => {
  it('weights and profile: a slow load of the previous user is dropped', async () => {
    const first = createLocalRepositories(userId)
    await first.weights.save({ id: newId(), userId, date: TODAY, measuredAt: '2026-10-07T07:00:00.000Z', weightKg: 81, inputUnit: 'kg', note: null, createdAt: '2026-10-07T07:00:00.000Z', updatedAt: '2026-10-07T07:00:00.000Z' })
    const held = gate()
    setRepositories(slowReads(userId, held))
    const weights = useWeightStore.getState().load()
    const profile = useProfileStore.getState().load()
    // Sign-out → the next user's session starts before the old reads finish.
    resetUserStores()
    setRepositories(createLocalRepositories(newId()))
    held.open()
    await Promise.all([weights, profile])
    expect(useWeightStore.getState()).toMatchObject({ entries: [], status: 'idle' })
    expect(useProfileStore.getState()).toMatchObject({ profile: null, status: 'idle' })
  })

  it('meals: a save that finishes after a session switch is not shown to the next user', async () => {
    const held = gate()
    const base = createLocalRepositories(userId)
    setRepositories({ ...base, meals: { ...base.meals, save: async (entry) => { await held.wait(); return base.meals.save(entry) } } })
    const saving = useMealsStore.getState().addPortions([portion()], 'snack', TODAY)
    resetUserStores()
    setRepositories(createLocalRepositories(newId()))
    held.open()
    await saving
    expect(useMealsStore.getState().days).toEqual({})
    expect(useMealsStore.getState().recentEntries).toEqual([])
  })
})

describe('a failed save rolls back only its own record', () => {
  it('weights: a concurrent weigh-in survives the rollback of another one', async () => {
    const base = createLocalRepositories(userId)
    const held = gate()
    let calls = 0
    setRepositories({
      ...base,
      weights: {
        ...base.weights,
        save: async (entry) => {
          calls += 1
          if (calls === 1) {
            await held.wait()
            throw new RepositoryError('disk full', { retryable: false })
          }
          return base.weights.save(entry)
        },
      },
    })
    const failing = useWeightStore.getState().add(weighIn(70))
    const second = await useWeightStore.getState().add(weighIn(71))
    expect(second.ok).toBe(true)
    held.open()
    expect((await failing).ok).toBe(false)
    expect(useWeightStore.getState().entries.map((e) => e.weightKg)).toEqual([71])
  })
})
