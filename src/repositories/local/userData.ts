import {
  openDatabase,
  USER_STORES,
  userCompoundRange,
  userMetaKeyRange,
  type NutritionistDatabase,
  type UserStoreName,
} from '@/lib/idb'
import { parseStoredList, runLocal, STORE_SPECS, type UserStoreRecord } from './core'

/** Raw (unvalidated) values of `userId` in `store`, in index order. */
async function rawForUser(db: NutritionistDatabase, store: UserStoreName, userId: string): Promise<unknown[]> {
  switch (store) {
    case 'profiles': {
      const profile = await db.get('profiles', userId)
      return profile === undefined ? [] : [profile]
    }
    case 'foods':
    case 'meals':
    case 'weights':
    case 'favorites':
    case 'savedMeals':
      return db.getAllFromIndex(store, 'byUser', userId)
    case 'workouts':
    case 'scheduledWorkouts':
      return db.getAllFromIndex(store, 'byUserDate', userCompoundRange(userId))
    case 'outbox':
      return db.getAllFromIndex('outbox', 'byUserCreated', userCompoundRange(userId))
  }
}

async function countForUser(db: NutritionistDatabase, store: UserStoreName, userId: string): Promise<number> {
  switch (store) {
    case 'profiles':
      return db.count('profiles', userId)
    case 'foods':
    case 'meals':
    case 'weights':
    case 'favorites':
    case 'savedMeals':
      return db.countFromIndex(store, 'byUser', userId)
    case 'workouts':
    case 'scheduledWorkouts':
      return db.countFromIndex(store, 'byUserDate', userCompoundRange(userId))
    case 'outbox':
      return db.countFromIndex('outbox', 'byUserCreated', userCompoundRange(userId))
  }
}

/**
 * Every valid record of `userId` in one store (invalid records are skipped with a warning).
 * Order: outbox by `createdAt` (FIFO), workouts/scheduled by date, everything else by id.
 * Used by guest → account migration and by the sync layer.
 */
export function listAllForUser<S extends UserStoreName>(store: S, userId: string): Promise<UserStoreRecord<S>[]> {
  return runLocal(`${store}.listAllForUser`, async () => {
    const db = await openDatabase()
    return parseStoredList(STORE_SPECS[store], await rawForUser(db, store, userId), userId)
  })
}

export type UserRecordCounts = Record<UserStoreName, number>

/**
 * Number of records stored for `userId` per store (including the outbox). Counts what is stored,
 * so a record that fails validation is counted here but skipped by `listAllForUser`.
 */
export function countUserRecords(userId: string): Promise<UserRecordCounts> {
  return runLocal('countUserRecords', async () => {
    const db = await openDatabase()
    const counts = await Promise.all(USER_STORES.map((store) => countForUser(db, store, userId)))
    return Object.fromEntries(USER_STORES.map((store, i) => [store, counts[i] ?? 0])) as UserRecordCounts
  })
}

/**
 * Deletes everything stored for `userId` — every user store, the outbox and its `userMetaKey` meta
 * entries — in ONE transaction (all or nothing). Other users' data is untouched.
 */
export function clearUserData(userId: string): Promise<void> {
  return runLocal('clearUserData', async () => {
    const db = await openDatabase()
    const tx = db.transaction([...USER_STORES, 'meta'], 'readwrite')
    const byUser = ['foods', 'meals', 'weights', 'favorites', 'savedMeals'] as const
    const byUserDate = ['workouts', 'scheduledWorkouts'] as const
    const [userKeys, dateKeys, outboxKeys] = await Promise.all([
      Promise.all(byUser.map((store) => tx.objectStore(store).index('byUser').getAllKeys(userId))),
      Promise.all(byUserDate.map((store) => tx.objectStore(store).index('byUserDate').getAllKeys(userCompoundRange(userId)))),
      tx.objectStore('outbox').index('byUserCreated').getAllKeys(userCompoundRange(userId)),
    ])
    await Promise.all([
      tx.objectStore('profiles').delete(userId),
      tx.objectStore('meta').delete(userMetaKeyRange(userId)),
      ...byUser.flatMap((store, i) => (userKeys[i] ?? []).map((key) => tx.objectStore(store).delete(key))),
      ...byUserDate.flatMap((store, i) => (dateKeys[i] ?? []).map((key) => tx.objectStore(store).delete(key))),
      ...outboxKeys.map((key) => tx.objectStore('outbox').delete(key)),
      tx.done,
    ])
  })
}
