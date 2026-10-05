import { STORE_FOR_ENTITY, type EntityStoreName } from '@/lib/idb'
import { checkDateRange, readOwner, recordIdOf, type EntityRecordMap } from '@/schemas'
import { recordKey } from '@/services/sync/coalesce'
import { readQueue, runSyncTransaction, type SyncTransaction } from '@/services/sync/outboxStore'
import type { DateRange } from '@/repositories/types'
import type { MealEntry, SyncEntity } from '@/types'

/**
 * Cache scopes and the cache refresh used by synced reads. A scope lists the primary keys of the
 * cached records a remote read covers (e.g. "meals of 2026-10-01…07"), so records the server no
 * longer has can be removed from the cache.
 */
export type ScopeKeys<T> = (tx: SyncTransaction, server: readonly T[]) => Promise<IDBValidKey[]>

const none = (): Promise<IDBValidKey[]> => Promise.resolve([])

export function profileScope(userId: string): ScopeKeys<unknown> {
  return (tx) => tx.objectStore('profiles').getAllKeys(userId)
}

export function userScope(store: 'foods' | 'weights' | 'favorites' | 'savedMeals' | 'meals', userId: string): ScopeKeys<unknown> {
  return (tx) => tx.objectStore(store).index('byUser').getAllKeys(userId)
}

/** One food id, only when the cached food belongs to `userId`. */
export function ownedFoodScope(userId: string, id: string): ScopeKeys<unknown> {
  return async (tx) => (readOwner(await tx.objectStore('foods').get(id), 'createdBy') === userId ? [id] : [])
}

/** Cached records of `userId` dated within `range` (validated when the scope is read, never at construction). */
export function dateScope(store: 'meals' | 'workouts' | 'scheduledWorkouts', userId: string, range: DateRange): ScopeKeys<unknown> {
  return (tx) => {
    const bounds = checkDateRange(range)
    if (!bounds) return none()
    return tx.objectStore(store).index('byUserDate').getAllKeys(IDBKeyRange.bound([userId, bounds.from], [userId, bounds.to]))
  }
}

/**
 * Scope of a "most recent `max` meals" read: everything when the server returned fewer than `max`
 * entries, otherwise the cached entries logged strictly after the oldest returned one (entries at
 * that exact instant may lie beyond the page, so they are left alone).
 */
export function recentMealsScope(userId: string, max: number): ScopeKeys<MealEntry> {
  return (tx, server) => {
    if (max === 0) return none()
    if (server.length < max) return tx.objectStore('meals').index('byUser').getAllKeys(userId)
    const oldest = server.reduce((min, entry) => (entry.loggedAt < min ? entry.loggedAt : min), server[0]?.loggedAt ?? '')
    return tx.objectStore('meals').index('byUserLoggedAt').getAllKeys(IDBKeyRange.bound([userId, oldest], [userId, []], true))
  }
}

export interface RefreshInput<E extends SyncEntity> {
  userId: string
  entity: E
  server: readonly EntityRecordMap[E][]
  scope: ScopeKeys<EntityRecordMap[E]>
  /** `recordKey`s acknowledged while the remote read ran (their server copy may predate the write). */
  acked: ReadonlySet<string>
}

/**
 * Replaces the cached records in scope with the server's, in ONE transaction that also reads the
 * outbox: records with a queued mutation (or acknowledged during the read) keep their local
 * version — so pending deletes stay hidden and pending edits are never overwritten by a stale copy.
 */
export function refreshCache<E extends SyncEntity>({ userId, entity, server, scope, acked }: RefreshInput<E>): Promise<void> {
  const store: EntityStoreName = STORE_FOR_ENTITY[entity]
  return runSyncTransaction(`${store}.refreshCache`, ['outbox', store], async (tx) => {
    const queued = await readQueue(tx, userId)
    const cachedKeys = await scope(tx, server)
    const keep = new Set(acked)
    for (const mutation of queued) keep.add(recordKey(mutation.entity, mutation.recordId))
    const isKept = (id: string): boolean => keep.has(recordKey(entity, id))

    const cache = tx.objectStore(store)
    const serverIds = new Set<string>()
    const writes: Promise<unknown>[] = []
    for (const record of server) {
      const id = recordIdOf(entity, record)
      serverIds.add(id)
      if (!isKept(id)) writes.push(cache.put(record))
    }
    for (const key of cachedKeys) {
      if (typeof key === 'string' && !serverIds.has(key) && !isKept(key)) writes.push(cache.delete(key))
    }
    await Promise.all(writes)
  })
}
