import { openDatabase, STORE_FOR_ENTITY, userCompoundRange, type StoreName } from '@/lib/idb'
import { logger } from '@/lib/logger'
import { newId } from '@/lib/id'
import { parseStoredList, runLocal, STORE_SPECS } from '@/repositories/local'
import type { OutboxMutation } from '@/types'
import { createAckLog, DEFAULT_ACK_LOG_SIZE } from './ackLog'
import { coalesceMutation, createMutation, nextQueueTimestamp, recordKey, type EnqueueInput } from './coalesce'
import { createListenerSet } from './listeners'
import { countQueue, createOutboxIndex, type OutboxCounts } from './outboxIndex'
import {
  assertValidMutation,
  canonicalPayload,
  mirrorToCache,
  newestQueuedAt,
  ownMutation,
  readQueue,
  runSyncTransaction,
  type SyncTransaction,
} from './outboxStore'
import type { EnqueueOptions, Outbox, OutboxOptions } from './outboxTypes'
import { systemClock } from './timers'

export type { EnqueueOptions, Outbox, OutboxOptions, RetrySchedule } from './outboxTypes'

export function createOutbox(userId: string, options: OutboxOptions = {}): Outbox {
  const clock = options.clock ?? systemClock
  const makeId = options.newId ?? newId
  const index = createOutboxIndex()
  const acks = createAckLog(options.ackLogSize ?? DEFAULT_ACK_LOG_SIZE)
  const listeners = createListenerSet<OutboxCounts>('outbox')

  /** One readwrite transaction; a failure aborts it and resets the in-memory index. */
  const transaction = <T>(operation: string, stores: StoreName[], work: (tx: SyncTransaction) => Promise<T>) =>
    runSyncTransaction(`outbox.${operation}`, stores, work, () => index.invalidate())

  const list = (): Promise<OutboxMutation[]> =>
    runLocal('outbox.list', async () => {
      const version = index.version
      const db = await openDatabase()
      const raw = await db.getAllFromIndex('outbox', 'byUserCreated', userCompoundRange(userId))
      const queue = parseStoredList(STORE_SPECS.outbox, raw, userId)
      index.rebuild(queue, version)
      return queue
    })

  const get = (id: string): Promise<OutboxMutation | null> =>
    runLocal('outbox.get', async () => {
      const db = await openDatabase()
      return ownMutation(await db.get('outbox', id), userId)
    })

  const counts = async (): Promise<OutboxCounts> => {
    if (index.loaded) return index.counts()
    const queue = await list()
    return index.loaded ? index.counts() : countQueue(queue)
  }

  const notify = (): void => {
    counts().then(listeners.emit, (error: unknown) => logger.warn('outbox', 'Could not count queued changes', error))
  }

  /** The queued mutation for a record key (index lookup, verified against the database). */
  const findQueued = async (tx: SyncTransaction, key: string): Promise<OutboxMutation | null> => {
    if (!index.loaded) {
      const version = index.version
      const queue = (await readQueue(tx, userId)).flatMap((value) => ownMutation(value, userId) ?? [])
      index.rebuild(queue, version)
      if (!index.loaded) return queue.find((m) => recordKey(m.entity, m.recordId) === key) ?? null
    }
    const id = index.idForRecord(key)
    if (id === undefined) return null
    const found = ownMutation(await tx.objectStore('outbox').get(id), userId)
    return found && recordKey(found.entity, found.recordId) === key ? found : null
  }

  const enqueue = async (input: EnqueueInput, opts: EnqueueOptions = {}): Promise<OutboxMutation> => {
    const payload = canonicalPayload(input, userId)
    const change: EnqueueInput = { ...input, payload }
    const stores: StoreName[] = opts.mirrorToCache ? ['outbox', STORE_FOR_ENTITY[input.entity]] : ['outbox']
    const mutation = await transaction('enqueue', stores, async (tx) => {
      const existing = await findQueued(tx, recordKey(input.entity, input.recordId))
      const next = existing
        ? coalesceMutation(existing, change, makeId())
        : createMutation(change, {
            id: makeId(),
            userId,
            createdAt: nextQueueTimestamp(clock(), await newestQueuedAt(tx, userId)),
          })
      const valid = assertValidMutation(next)
      const queue = tx.objectStore('outbox')
      if (existing) await queue.delete(existing.id)
      await queue.put(valid)
      if (opts.mirrorToCache) await mirrorToCache(tx, userId, input.entity, input.recordId, payload)
      return valid
    })
    index.set(mutation)
    notify()
    return mutation
  }

  /** Read-modify-write of one mutation; `change` returns null to leave it untouched. */
  const update = async (
    operation: string,
    id: string,
    change: (current: OutboxMutation) => OutboxMutation | null,
  ): Promise<OutboxMutation | null> => {
    const updated = await transaction(operation, ['outbox'], async (tx) => {
      const current = ownMutation(await tx.objectStore('outbox').get(id), userId)
      const next = current ? change(current) : null
      if (next) await tx.objectStore('outbox').put(next)
      return next
    })
    if (updated) {
      index.set(updated)
      notify()
    }
    return updated
  }

  const removeOne = async (operation: string, id: string): Promise<boolean> => {
    const removed = await transaction(operation, ['outbox'], async (tx) => {
      const current = ownMutation(await tx.objectStore('outbox').get(id), userId)
      if (current) await tx.objectStore('outbox').delete(id)
      return current !== null
    })
    if (removed) {
      index.delete(id)
      notify()
    }
    return removed
  }

  /** Applies `change` to every failed mutation (optionally only `ids`); null deletes it. */
  const updateFailed = async (
    operation: string,
    ids: readonly string[] | undefined,
    change: (failed: OutboxMutation) => OutboxMutation | null,
  ): Promise<number> => {
    const only = ids ? new Set(ids) : null
    const results = await transaction(operation, ['outbox'], async (tx) => {
      const queue = (await readQueue(tx, userId)).flatMap((value) => ownMutation(value, userId) ?? [])
      const targets = queue.filter((m) => m.status === 'failed' && (only === null || only.has(m.id)))
      const store = tx.objectStore('outbox')
      const applied = targets.map((failed) => ({ id: failed.id, next: change(failed) }))
      await Promise.all(applied.map(({ id, next }) => (next ? store.put(next) : store.delete(id))))
      return applied
    })
    for (const { id, next } of results) {
      if (next) index.set(next)
      else index.delete(id)
    }
    if (results.length > 0) notify()
    return results.length
  }

  return {
    userId,
    enqueue,
    list,
    get,
    scheduleRetry: (id, retry) =>
      update('scheduleRetry', id, (m) =>
        m.status === 'pending'
          ? { ...m, attempts: m.attempts + 1, lastError: retry.error, nextAttemptAt: retry.nextAttemptAt }
          : null,
      ),
    markFailed: (id, error) =>
      update('markFailed', id, (m) => ({ ...m, status: 'failed', attempts: m.attempts + 1, lastError: error, nextAttemptAt: null })),
    ack: (mutation) => {
      // Logged before removal so a concurrent read never sees "neither queued nor acknowledged".
      acks.record(recordKey(mutation.entity, mutation.recordId))
      return removeOne('ack', mutation.id)
    },
    remove: (id) => removeOne('remove', id),
    retryFailed: (ids) =>
      updateFailed('retryFailed', ids, (m) => ({ ...m, status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null })),
    discardFailed: (ids) => updateFailed('discardFailed', ids, () => null),
    counts,
    subscribe: (listener) => listeners.add(listener),
    ackMark: () => acks.mark(),
    ackedSince: (mark) => acks.since(mark),
  }
}
