import type { MutationOp, OutboxMutation, SyncEntity } from '@/types'

/** A change to queue: the domain record for upserts, `null` for deletes. */
export interface EnqueueInput {
  entity: SyncEntity
  op: MutationOp
  recordId: string
  payload: unknown
}

/** Coalescing key: at most one queued mutation exists per (entity, record). */
export function recordKey(entity: SyncEntity, recordId: string): string {
  return `${entity}:${recordId}`
}

export function createMutation(
  input: EnqueueInput,
  fields: { id: string; userId: string; createdAt: string },
): OutboxMutation {
  return {
    id: fields.id,
    userId: fields.userId,
    entity: input.entity,
    op: input.op,
    recordId: input.recordId,
    payload: input.op === 'delete' ? null : input.payload,
    createdAt: fields.createdAt,
    attempts: 0,
    status: 'pending',
    lastError: null,
    nextAttemptAt: null,
  }
}

/**
 * Folds a new change into the queued mutation for the same record, keeping its queue position
 * (`createdAt`): upsert+upsert → the newer payload, upsert+delete → delete, delete+upsert → upsert.
 *
 * The result gets a NEW mutation id: a flush that is already sending the old version acknowledges
 * the old id, which no longer exists, so the newer change is never dropped by that acknowledgement.
 * Retry bookkeeping of a pending mutation is kept (it reflects server health, not the payload);
 * a failed mutation becomes pending again with fresh bookkeeping because the user changed the record.
 */
export function coalesceMutation(existing: OutboxMutation, input: EnqueueInput, id: string): OutboxMutation {
  const base: OutboxMutation = {
    ...existing,
    id,
    op: input.op,
    payload: input.op === 'delete' ? null : input.payload,
  }
  if (existing.status === 'pending') return base
  return { ...base, status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null }
}

/**
 * Queue timestamp for a new mutation: the current time, or 1 ms after the newest queued mutation
 * when the clock has not moved past it, so FIFO order never depends on random ids (several changes
 * in the same millisecond, or a clock that stepped backwards).
 */
export function nextQueueTimestamp(now: Date, newestQueued: string | null): string {
  const nowMs = now.getTime()
  if (newestQueued === null) return new Date(nowMs).toISOString()
  const newestMs = Date.parse(newestQueued)
  return new Date(Number.isNaN(newestMs) ? nowMs : Math.max(nowMs, newestMs + 1)).toISOString()
}
