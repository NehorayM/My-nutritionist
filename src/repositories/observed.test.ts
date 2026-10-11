import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { makeMeal, USER_A } from '@/schemas/__fixtures__/records'
import { createLocalRepositories } from './local'
import { observeWrites } from './observed'

beforeEach(async () => {
  await deleteDatabase()
})

describe('observeWrites', () => {
  it('reports successful saves and removes with their table, never reads or failures', async () => {
    const onWrite = vi.fn<(entity: string) => void>()
    const repos = observeWrites(createLocalRepositories(USER_A), onWrite)
    await repos.meals.save(makeMeal())
    await repos.meals.remove(makeMeal().id)
    await repos.meals.listByDate('2026-10-03')
    await expect(repos.meals.save({ ...makeMeal(), grams: -1 })).rejects.toThrow(/Invalid meal entry/)
    expect(onWrite.mock.calls).toEqual([['meal_logs'], ['meal_logs']])
  })

  it('keeps the user binding and every repository', () => {
    const repos = observeWrites(createLocalRepositories(USER_A), () => undefined)
    expect(repos.userId).toBe(USER_A)
    expect(Object.keys(repos).sort()).toEqual(Object.keys(createLocalRepositories(USER_A)).sort())
  })
})
