import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase, openDatabase } from '@/lib/idb'
import { logger } from '@/lib/logger'
import { RepositoryError, type Repositories } from '@/repositories/types'
import {
  makeFavorite,
  makeFood,
  makeMeal,
  makeProfile,
  makeSavedMeal,
  makeWeight,
  testId,
  USER_A,
  USER_B,
} from '@/schemas/__fixtures__/records'
import { createLocalRepositories } from './index'

let repos: Repositories
let other: Repositories

beforeEach(async () => {
  await deleteDatabase()
  repos = createLocalRepositories(USER_A)
  other = createLocalRepositories(USER_B)
})

afterEach(async () => {
  await deleteDatabase()
})

describe('profile', () => {
  it('returns null before a profile exists, then the saved profile', async () => {
    expect(await repos.profile.get()).toBeNull()
    const saved = await repos.profile.save(makeProfile({ displayName: 'Dana' }))
    expect(saved.displayName).toBe('Dana')
    expect(await repos.profile.get()).toEqual(saved)
    expect(await other.profile.get()).toBeNull()
    await expect(other.profile.save(makeProfile())).rejects.toMatchObject({ retryable: false })
  })
})

describe('list-based repositories', () => {
  it('foods: CRUD, getById, owner isolation', async () => {
    const food = makeFood()
    expect(await repos.foods.save(food)).toEqual(food)
    expect(await repos.foods.list()).toEqual([food])
    expect(await repos.foods.getById(food.id)).toEqual(food)
    expect(await other.foods.getById(food.id)).toBeNull()
    expect(await other.foods.list()).toEqual([])
    const updated = await repos.foods.save({ ...food, name: 'Apple cake', updatedAt: '2026-10-04T08:00:00.000Z' })
    expect(await repos.foods.list()).toEqual([updated])
    await repos.foods.remove(food.id)
    expect(await repos.foods.getById(food.id)).toBeNull()
    expect(await repos.foods.getById(testId(999))).toBeNull()
  })

  it('foods: system foods cannot be saved as user data', async () => {
    const system = makeFood({ source: 'system', createdBy: null })
    await expect(repos.foods.save(system)).rejects.toBeInstanceOf(RepositoryError)
  })

  it('weights, favorites, saved meals: save, update in place, remove', async () => {
    await repos.weights.save(makeWeight())
    const weight = await repos.weights.save(makeWeight({ weightKg: 71.9 }))
    await repos.favorites.save(makeFavorite())
    const favorite = await repos.favorites.save(makeFavorite({ updatedAt: '2026-10-05T00:00:00.000Z' }))
    await repos.savedMeals.save(makeSavedMeal())
    const savedMeal = await repos.savedMeals.save(makeSavedMeal({ name: 'Weekend shakshuka' }))

    expect(await repos.weights.list()).toEqual([weight])
    expect(await repos.favorites.list()).toEqual([favorite])
    expect(await repos.savedMeals.list()).toEqual([savedMeal])
    expect(await other.savedMeals.list()).toEqual([])

    await repos.weights.remove(weight.id)
    await repos.favorites.remove(favorite.id)
    await repos.savedMeals.remove(savedMeal.id)
    expect([await repos.weights.list(), await repos.favorites.list(), await repos.savedMeals.list()]).toEqual([[], [], []])
  })

  it('removing a missing record, or another user’s record, changes nothing', async () => {
    await repos.weights.save(makeWeight())
    await other.weights.remove(makeWeight().id)
    await repos.weights.remove(testId(12345))
    expect(await repos.weights.list()).toHaveLength(1)
  })

  it('rejects records owned by another user and invalid records without writing them', async () => {
    const foreign = repos.weights.save(makeWeight({ userId: USER_B }))
    await expect(foreign).rejects.toMatchObject({ name: 'RepositoryError', retryable: false })
    const invalid = repos.weights.save(makeWeight({ weightKg: 401 }))
    await expect(invalid).rejects.toThrow(/Invalid weigh-in: check weightKg/)
    expect(await repos.weights.list()).toEqual([])
    expect(await other.weights.list()).toEqual([])
  })

  it('stores canonical UTC timestamps', async () => {
    const saved = await repos.weights.save(makeWeight({ measuredAt: '2026-10-03T08:30:00+03:00' }))
    expect(saved.measuredAt).toBe('2026-10-03T05:30:00.000Z')
    expect((await repos.weights.list())[0]?.measuredAt).toBe('2026-10-03T05:30:00.000Z')
  })
})

describe('invalid stored records', () => {
  it('are skipped on read with a warning that carries no record contents', async () => {
    const warn = vi.spyOn(logger, 'warn')
    await repos.meals.save(makeMeal({ id: testId(1) }))
    const db = await openDatabase()
    await db.put('meals', { ...makeMeal({ id: testId(2) }), foodName: '' })
    await db.put('meals', { ...makeMeal({ id: testId(3) }), date: '2026-10-03', mealType: 'brunch' as never })
    await db.put('weights', { ...makeWeight(), weightKg: 5 })
    await db.put('foods', { ...makeFood(), per100g: { calories: -1 } as never })

    expect((await repos.meals.listByDate('2026-10-03')).map((m) => m.id)).toEqual([testId(1)])
    expect(await repos.weights.list()).toEqual([])
    expect(await repos.foods.getById(makeFood().id)).toBeNull()
    expect(warn).toHaveBeenCalledWith('local-db', 'Skipped 2 invalid meal entry record(s)')
    expect(warn).toHaveBeenCalledWith('local-db', 'Skipped 1 invalid weigh-in record(s)')
    for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toContain('Apple')
  })

  it('can still be removed by their owner', async () => {
    const db = await openDatabase()
    await db.put('weights', { ...makeWeight(), weightKg: 5 })
    await repos.weights.remove(makeWeight().id)
    expect(await db.get('weights', makeWeight().id)).toBeUndefined()
  })
})

describe('storage failures', () => {
  it('become non-retryable RepositoryErrors naming the operation', async () => {
    const db = await openDatabase()
    vi.spyOn(db, 'put').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    const failure = repos.meals.save(makeMeal())
    await expect(failure).rejects.toBeInstanceOf(RepositoryError)
    await expect(failure).rejects.toMatchObject({
      retryable: false,
      message: 'Local storage could not complete meals.save (QuotaExceededError)',
    })
  })
})
