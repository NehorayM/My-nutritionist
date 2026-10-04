import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from './logger'
import {
  closeDatabase,
  DB_NAME,
  DB_VERSION,
  deleteDatabase,
  openDatabase,
  STORE_FOR_ENTITY,
  USER_STORES,
  userCompoundRange,
  userMetaKey,
  userMetaKeyRange,
} from './idb'

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  await deleteDatabase()
})

describe('openDatabase', () => {
  it('creates every store with its key path and indexes', async () => {
    const db = await openDatabase()
    expect(db.name).toBe(DB_NAME)
    expect(db.version).toBe(DB_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual([...USER_STORES, 'meta'].sort())

    const tx = db.transaction([...USER_STORES, 'meta'])
    const describeStore = (name: (typeof USER_STORES)[number] | 'meta') => {
      const store = tx.objectStore(name)
      const indexes = Object.fromEntries(
        [...store.indexNames].map((index) => [index, store.index(index as never).keyPath]),
      )
      return { keyPath: store.keyPath, indexes }
    }
    expect(describeStore('profiles')).toEqual({ keyPath: 'userId', indexes: {} })
    expect(describeStore('foods')).toEqual({ keyPath: 'id', indexes: { byUser: 'createdBy' } })
    expect(describeStore('meals')).toEqual({
      keyPath: 'id',
      indexes: { byUser: 'userId', byUserDate: ['userId', 'date'], byUserLoggedAt: ['userId', 'loggedAt'] },
    })
    expect(describeStore('weights')).toEqual({ keyPath: 'id', indexes: { byUser: 'userId' } })
    expect(describeStore('workouts')).toEqual({ keyPath: 'id', indexes: { byUserDate: ['userId', 'date'] } })
    expect(describeStore('scheduledWorkouts')).toEqual({ keyPath: 'id', indexes: { byUserDate: ['userId', 'date'] } })
    expect(describeStore('favorites')).toEqual({ keyPath: 'id', indexes: { byUser: 'userId' } })
    expect(describeStore('savedMeals')).toEqual({ keyPath: 'id', indexes: { byUser: 'userId' } })
    expect(describeStore('outbox')).toEqual({ keyPath: 'id', indexes: { byUserCreated: ['userId', 'createdAt'] } })
    expect(describeStore('meta')).toEqual({ keyPath: 'key', indexes: {} })
    await tx.done
  })

  it('shares one connection until it is closed', async () => {
    const first = await openDatabase()
    expect(await openDatabase()).toBe(first)
    await closeDatabase()
    const second = await openDatabase()
    expect(second).not.toBe(first)
  })

  it('persists data across reconnects and deleteDatabase removes it', async () => {
    const db = await openDatabase()
    await db.put('meta', { key: 'k', value: 1 })
    await closeDatabase()
    expect(await (await openDatabase()).get('meta', 'k')).toEqual({ key: 'k', value: 1 })
    await deleteDatabase()
    expect(await (await openDatabase()).get('meta', 'k')).toBeUndefined()
  })

  it('steps aside when another tab upgrades, and recovers once the version conflict is gone', async () => {
    const ours = await openDatabase()
    // A newer app version in another tab: our connection must close so this upgrade is not blocked.
    const newer = await openDB(DB_NAME, DB_VERSION + 1)
    expect(newer.version).toBe(DB_VERSION + 1)
    newer.close()
    expect(() => ours.transaction('meta')).toThrow(expect.objectContaining({ name: 'InvalidStateError' }))
    // Our (older) version can no longer open; the failed open is not cached.
    await expect(openDatabase()).rejects.toThrow(expect.objectContaining({ name: 'VersionError' }))
    await deleteDatabase()
    expect((await openDatabase()).version).toBe(DB_VERSION)
  })
})

describe('deleteDatabase', () => {
  it('waits for another open connection to close, with a warning', async () => {
    await openDatabase()
    await closeDatabase()
    const otherTab = await openDB(DB_NAME, DB_VERSION)
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => otherTab.close())
    await deleteDatabase()
    expect(warn).toHaveBeenCalledWith('idb', 'Database deletion is waiting for other open tabs of the app to close')
    expect((await openDatabase()).objectStoreNames).toHaveLength(USER_STORES.length + 1)
  })
})

describe('key helpers', () => {
  it('userMetaKeyRange covers exactly one user’s meta keys', () => {
    const range = userMetaKeyRange('user-a')
    expect(range.includes(userMetaKey('user-a', 'lastPull'))).toBe(true)
    expect(range.includes(userMetaKey('user-a', ''))).toBe(true)
    expect(range.includes(userMetaKey('user-ab', 'lastPull'))).toBe(false)
    expect(range.includes('user-a')).toBe(false)
  })

  it('userCompoundRange covers every [userId, …] key and nothing else', () => {
    const range = userCompoundRange('u1')
    expect(range.includes(['u1', '0000-01-01'])).toBe(true)
    expect(range.includes(['u1', '￿￿'])).toBe(true)
    expect(range.includes(['u0', '2026-10-03'])).toBe(false)
    expect(range.includes(['u2', '2026-10-03'])).toBe(false)
  })

  it('maps every sync entity to a store', () => {
    expect(Object.values(STORE_FOR_ENTITY).sort()).toEqual(USER_STORES.filter((s) => s !== 'outbox').sort())
  })
})
