import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { createLocalRepositories } from '@/repositories/local'
import { mealEntryToRow } from '@/repositories/supabase/mappers'
import { testId, USER_A } from '@/schemas/__fixtures__/records'
import { createEngineHarness, holdSends, meal, upsertMeal, type EngineHarness } from './__fixtures__/engineHarness'
import { createMemoryLock } from './locks'

/** Conflicts the server resolves (stale-write guard, tombstones) end up in this device's cache too. */
const harnesses: EngineHarness[] = []
const setup = (options: Parameters<typeof createEngineHarness>[0] = {}) => {
  const h = createEngineHarness(options)
  harnesses.push(h)
  return h
}
const cached = () => createLocalRepositories(USER_A).meals.listByDate('2026-10-03')
const OLD = '2026-10-03T08:00:00.000Z'
const NEWER = '2026-10-05T08:00:00.000Z'

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  for (const h of harnesses.splice(0)) h.engine.dispose()
  await deleteDatabase()
})

describe('sync engine: server-side conflict outcomes', () => {
  it('replaces the cached copy with the newer server version when the server keeps it', async () => {
    const h = setup()
    h.db.seed('meal_logs', mealEntryToRow(meal(1, { mealType: 'dinner', updatedAt: NEWER })))
    await h.outbox.enqueue(upsertMeal(1, { mealType: 'breakfast', updatedAt: OLD }), { mirrorToCache: true })
    await h.engine.flushNow()
    expect(await cached()).toEqual([expect.objectContaining({ id: testId(1), mealType: 'dinner', updatedAt: NEWER })])
    expect(await h.outbox.list()).toEqual([])
    expect(h.events).toContainEqual({ type: 'reconciled', entities: ['meal_logs'] })
  })

  it('removes the cached copy when the record was deleted on another device with this or a newer version', async () => {
    const h = setup()
    h.db.seed('meal_logs', mealEntryToRow(meal(1, { updatedAt: OLD })))
    await createLocalRepositories(USER_A).meals.save(meal(1, { updatedAt: OLD }))
    // Another device deletes the record…
    await h.db.from('meal_logs').delete().eq('id', testId(1))
    // …while this device still sends its (unchanged) version.
    await h.outbox.enqueue(upsertMeal(1, { updatedAt: OLD }), { mirrorToCache: true })
    await h.engine.flushNow()
    expect(h.db.rows('meal_logs')).toEqual([])
    expect(await cached()).toEqual([])
    expect(h.events).toContainEqual({ type: 'reconciled', entities: ['meal_logs'] })
  })

  it('keeps a newer local change that was queued while the conflicting version was in flight', async () => {
    const h = setup()
    h.db.seed('meal_logs', mealEntryToRow(meal(1, { mealType: 'dinner', updatedAt: NEWER })))
    await h.outbox.enqueue(upsertMeal(1, { mealType: 'breakfast', updatedAt: OLD }), { mirrorToCache: true })
    const release = holdSends(h)
    const pass = h.engine.flushNow()
    await vi.waitFor(() => expect(h.sends).toHaveLength(1))
    const latest = '2026-10-06T08:00:00.000Z'
    await h.outbox.enqueue(upsertMeal(1, { mealType: 'lunch', updatedAt: latest }), { mirrorToCache: true })
    release()
    await pass
    expect(await cached()).toEqual([expect.objectContaining({ mealType: 'lunch', updatedAt: latest })])
    await h.engine.flushNow()
    expect(h.db.rows('meal_logs')).toEqual([expect.objectContaining({ meal_type: 'lunch' })])
  })

  it('does not report a conflict for an ordinary save', async () => {
    const h = setup()
    await h.outbox.enqueue(upsertMeal(1), { mirrorToCache: true })
    await h.engine.flushNow()
    expect(h.events.some((event) => event.type === 'reconciled')).toBe(false)
  })
})

describe('sync engine: several tabs of one user', () => {
  it('lets only one tab send at a time, so a delete made in another tab is applied last', async () => {
    const lock = createMemoryLock()
    const tabA = setup({ lock })
    const tabB = setup({ lock, db: tabA.db, idBase: 5000 })
    await tabA.outbox.enqueue(upsertMeal(1), { mirrorToCache: true })
    const release = holdSends(tabA)
    const passA = tabA.engine.flushNow()
    await vi.waitFor(() => expect(tabA.sends).toHaveLength(1))
    // Tab B deletes the record while tab A's upsert is still on its way.
    await tabB.outbox.enqueue({ entity: 'meal_logs', op: 'delete', recordId: testId(1), payload: null }, { mirrorToCache: true })
    const passB = tabB.engine.flushNow()
    await Promise.resolve()
    expect(tabB.sends).toEqual([])
    release()
    await Promise.all([passA, passB])
    expect(tabB.sends).toEqual([`delete:${testId(1)}`])
    expect(tabA.db.rows('meal_logs')).toEqual([])
    expect(await cached()).toEqual([])
  })
})
