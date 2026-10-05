import { backoffDelayMs, type BackoffPolicy } from './backoff'
import type { Outbox } from './outbox'
import { sendMutation, type RemoteWriters, type RetryKind } from './syncSend'
import type { Clock } from './timers'

export interface PassInput {
  outbox: Pick<Outbox, 'list' | 'get' | 'ack' | 'markFailed' | 'scheduleRetry'>
  remote: RemoteWriters
  clock: Clock
  policy: BackoffPolicy
  /** Send due-later mutations too (ignores backoff; used on reconnect). */
  force: boolean
  /** Checked between sends so a disposed engine stops promptly. */
  isCancelled: () => boolean
}

export interface PassResult {
  /** Mutations the server applied (and that were removed from the queue). */
  sent: number
  /** Mutations the server rejected (now marked failed). */
  rejected: number
  /** Epoch ms when the queue head may be retried; null when nothing due remains. */
  retryAt: number | null
  /** Why the pass stopped early, when it did. */
  retryKind: RetryKind | null
}

/**
 * One FIFO pass over the queue. Each mutation is re-read right before it is sent, so a version that
 * was replaced (coalesced) or discarded after the listing is never sent. A retryable failure schedules
 * the mutation's next attempt with exponential backoff and stops the pass, so later changes never
 * overtake earlier ones; a rejection marks the mutation failed and the pass continues.
 */
export async function runSendPass(input: PassInput): Promise<PassResult> {
  const { outbox, remote, clock, policy, force } = input
  const result: PassResult = { sent: 0, rejected: 0, retryAt: null, retryKind: null }
  const queue = await outbox.list()
  const listedAt = clock().getTime()
  for (const listed of queue) {
    if (input.isCancelled()) break
    if (listed.status !== 'pending') continue
    const dueAt = listed.nextAttemptAt === null ? listedAt : Date.parse(listed.nextAttemptAt)
    if (!force && dueAt > listedAt) {
      result.retryAt = dueAt
      break
    }
    const mutation = await outbox.get(listed.id)
    if (mutation === null || mutation.status !== 'pending') continue
    const outcome = await sendMutation(remote, mutation)
    if (outcome.outcome === 'sent') {
      await outbox.ack(mutation)
      result.sent += 1
    } else if (outcome.outcome === 'reject') {
      await outbox.markFailed(mutation.id, outcome.error)
      result.rejected += 1
    } else {
      result.retryAt = clock().getTime() + backoffDelayMs(mutation.attempts + 1, policy)
      result.retryKind = outcome.kind
      await outbox.scheduleRetry(mutation.id, { error: outcome.error, nextAttemptAt: new Date(result.retryAt).toISOString() })
      break
    }
  }
  return result
}
