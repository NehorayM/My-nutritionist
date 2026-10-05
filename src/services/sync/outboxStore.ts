import type { IDBPTransaction } from 'idb'
import { openDatabase, STORE_FOR_ENTITY, userCompoundRange, type NutritionistDB, type StoreName } from '@/lib/idb'
import { runLocal } from '@/repositories/local'
import { RepositoryError } from '@/repositories/types'
import {
  invalidFieldPaths,
  outboxMutationSchema,
  readOwner,
  RECORD_SPECS,
  recordIdOf,
  validateForWrite,
  type EntityRecordMap,
  type RecordSpec,
} from '@/schemas'
import type { OutboxMutation, SyncEntity } from '@/types'
import type { EnqueueInput } from './coalesce'

/** Any synchronizable domain record. */
export type SyncRecord = EntityRecordMap[SyncEntity]

/**
 * IndexedDB helpers shared by the outbox and the synced repositories. Every helper runs inside a
 * caller-owned transaction, so a cache change and its queued mutation commit (or fail) together.
 */
export type SyncTransaction = IDBPTransaction<NutritionistDB, StoreName[], 'readwrite'>

/**
 * Runs `work` in ONE readwrite transaction over `stores` and waits for it to commit. When anything
 * fails the transaction is aborted (no partial writes), `onFailure` runs and the error is rethrown
 * as a non-retryable `RepositoryError` (see `runLocal`).
 */
export function runSyncTransaction<T>(
  operation: string,
  stores: StoreName[],
  work: (tx: SyncTransaction) => Promise<T>,
  onFailure: () => void = () => undefined,
): Promise<T> {
  return runLocal(operation, async () => {
    const db = await openDatabase()
    const tx = db.transaction(stores, 'readwrite')
    const done = tx.done
    done.catch(() => undefined)
    try {
      const result = await work(tx)
      await done
      return result
    } catch (error) {
      onFailure()
      try {
        tx.abort()
      } catch {
        // The transaction already finished (it failed by itself).
      }
      throw error
    }
  })
}

/** Every queued mutation of `userId` in FIFO order (raw; callers validate when needed). */
export function readQueue(tx: SyncTransaction, userId: string): Promise<OutboxMutation[]> {
  return tx.objectStore('outbox').index('byUserCreated').getAll(userCompoundRange(userId))
}

/** `createdAt` of the newest queued mutation of `userId`, or null when the queue is empty. */
export async function newestQueuedAt(tx: SyncTransaction, userId: string): Promise<string | null> {
  const cursor = await tx.objectStore('outbox').index('byUserCreated').openCursor(userCompoundRange(userId), 'prev')
  return cursor ? cursor.value.createdAt : null
}

/** A stored mutation of `userId`, or null when it is missing, invalid or owned by someone else. */
export function ownMutation(value: unknown, userId: string): OutboxMutation | null {
  if (readOwner(value, 'userId') !== userId) return null
  const parsed = outboxMutationSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Rejects a mutation that does not satisfy the outbox schema (non-retryable, field paths only). */
export function assertValidMutation(mutation: OutboxMutation): OutboxMutation {
  const parsed = outboxMutationSchema.safeParse(mutation)
  if (!parsed.success) {
    throw new RepositoryError(`Invalid sync change: check ${invalidFieldPaths(parsed.error)}`, {
      retryable: false,
      cause: parsed.error,
    })
  }
  return parsed.data
}

/**
 * The canonical record for an upsert (validated against the entity schema and owned by `userId`),
 * or null for a delete. Invalid records are rejected before they can reach the queue.
 */
export function canonicalPayload(input: EnqueueInput, userId: string): SyncRecord | null {
  if (input.op === 'delete') return null
  const spec: RecordSpec<SyncRecord> = RECORD_SPECS[input.entity]
  // validateForWrite checks owner and shape at runtime; the cast only names what it verifies.
  const record = validateForWrite(spec, input.payload as SyncRecord, userId)
  if (recordIdOf(input.entity, record) !== input.recordId) {
    throw new RepositoryError(`Sync change for a ${spec.label} does not match the record id`, { retryable: false })
  }
  return record
}

/**
 * Applies a change to the entity's local cache store: upserts store the (already canonical) payload;
 * deletes remove the cached record only when it belongs to `userId`.
 */
export async function mirrorToCache(
  tx: SyncTransaction,
  userId: string,
  entity: SyncEntity,
  recordId: string,
  record: SyncRecord | null,
): Promise<void> {
  const store = tx.objectStore(STORE_FOR_ENTITY[entity])
  if (record !== null) {
    await store.put(record)
    return
  }
  const existing: unknown = await store.get(recordId)
  if (readOwner(existing, RECORD_SPECS[entity].ownerField) === userId) await store.delete(recordId)
}
