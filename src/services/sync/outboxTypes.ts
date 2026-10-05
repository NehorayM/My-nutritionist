import type { OutboxMutation } from '@/types'
import type { EnqueueInput } from './coalesce'
import type { OutboxCounts } from './outboxIndex'
import type { Clock } from './timers'

export interface OutboxOptions {
  clock?: Clock
  /** Mutation id generator (default: random UUID). */
  newId?: () => string
  /** How many recent acknowledgements reads can look back on (see `ackedSince`). */
  ackLogSize?: number
}

export interface EnqueueOptions {
  /** Apply the change to the entity's local cache store in the SAME transaction (synced repositories). */
  mirrorToCache?: boolean
}

export interface RetrySchedule {
  error: string
  /** ISO timestamp before which the mutation is not retried. */
  nextAttemptAt: string
}

/**
 * IndexedDB-backed queue of one user's local changes waiting for Supabase.
 * - At most one mutation per record: a new change for a queued record replaces it IN PLACE
 *   (upsert→newer upsert, upsert→delete, delete→upsert) and keeps its FIFO position.
 * - `list()` is FIFO by `createdAt`; retry bookkeeping lives on each mutation.
 * - Upsert payloads are validated against the entity schema before they are queued.
 */
export interface Outbox {
  readonly userId: string
  enqueue(input: EnqueueInput, options?: EnqueueOptions): Promise<OutboxMutation>
  /** Every queued mutation (pending and failed), oldest first. */
  list(): Promise<OutboxMutation[]>
  /** The queued mutation with this id, or null when it was acknowledged, replaced or removed. */
  get(id: string): Promise<OutboxMutation | null>
  /** Records a retryable failure: attempts + 1, `lastError`, `nextAttemptAt`. Null when gone or failed. */
  scheduleRetry(id: string, retry: RetrySchedule): Promise<OutboxMutation | null>
  /** Marks a mutation as failed (needs the user's Retry/Discard). Null when it is gone. */
  markFailed(id: string, error: string): Promise<OutboxMutation | null>
  /** Removes a mutation the server applied. False when it was already replaced or removed. */
  ack(mutation: Pick<OutboxMutation, 'id' | 'entity' | 'recordId'>): Promise<boolean>
  /** Removes a mutation without sending it. */
  remove(id: string): Promise<boolean>
  /** Failed → pending with fresh bookkeeping (all failed, or only `ids`). Returns how many changed. */
  retryFailed(ids?: readonly string[]): Promise<number>
  /** Deletes failed mutations (all, or only `ids`). Returns how many were removed. */
  discardFailed(ids?: readonly string[]): Promise<number>
  counts(): Promise<OutboxCounts>
  /** Called with fresh counts after every change made through this outbox. */
  subscribe(listener: (counts: OutboxCounts) => void): () => void
  /** Position in the acknowledgement log; pass it to `ackedSince` after a remote read. */
  ackMark(): number
  /** `recordKey`s acknowledged after `mark`; null when that history is no longer available. */
  ackedSince(mark: number): ReadonlySet<string> | null
}
