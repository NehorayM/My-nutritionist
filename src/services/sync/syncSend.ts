import { SupabaseRepositoryError, toRepositoryError, type RemoteErrorKind } from '@/repositories/supabase'
import { RepositoryError } from '@/repositories/types'
import { invalidFieldPaths, RECORD_SPECS, type EntityRecordMap } from '@/schemas'
import type { OutboxMutation, SyncEntity } from '@/types'

/** Per-table server writes used by the sync engine (the Supabase `RemoteTable`s satisfy this). */
export interface RemoteWriter<T> {
  /** Idempotent upsert by id. */
  upsert(record: T): Promise<unknown>
  /** Idempotent delete by id (a missing record is not an error). */
  remove(id: string): Promise<void>
}

export type RemoteWriters = { [E in SyncEntity]: RemoteWriter<EntityRecordMap[E]> }

/**
 * Outcome of sending one mutation:
 * - `retry`: keep it queued and back off (network, timeout, rate limit, 5xx, expired session)
 * - `reject`: the server will never accept it as is (validation, RLS, constraint) → mark failed
 */
export type SendResult =
  | { outcome: 'sent' }
  | { outcome: 'retry'; kind: RetryKind; error: string }
  | { outcome: 'reject'; error: string }

/** Why a retry is needed; decides the user-facing status message. */
export type RetryKind = 'unreachable' | 'busy' | 'session'

const UNREACHABLE: ReadonlySet<RemoteErrorKind> = new Set(['network', 'timeout'])

/** User-facing status line for each retry reason (neutral, no technical details). */
export const RETRY_MESSAGES: Record<RetryKind, string> = {
  unreachable: 'Can’t reach the server right now. Your changes are saved on this device and will sync automatically.',
  busy: 'The server is busy. Your changes are saved on this device and sync will try again shortly.',
  session: 'Please sign in again so your saved changes can sync to your account.',
}

/** Status line while queued changes wait for their next attempt and the reason is not known (e.g. after a reload). */
export const WAITING_MESSAGE = 'Some changes are waiting to sync. They’re saved on this device and will sync automatically.'

export function rejectedMessage(count: number): string {
  return count === 1
    ? '1 change couldn’t be saved to your account. You can retry or discard it in Profile.'
    : `${count} changes couldn’t be saved to your account. You can retry or discard them in Profile.`
}

async function upsertPayload<E extends SyncEntity>(remote: RemoteWriters, entity: E, payload: unknown): Promise<void> {
  const spec = RECORD_SPECS[entity]
  const parsed = spec.schema.safeParse(payload)
  if (!parsed.success) {
    throw new RepositoryError(`Invalid ${spec.label}: check ${invalidFieldPaths(parsed.error)}`, { retryable: false })
  }
  await remote[entity].upsert(parsed.data)
}

/** Classifies a failed send. Messages come from `RepositoryError`s, which never contain row values. */
function classify(error: unknown, mutation: OutboxMutation): SendResult {
  const operation = `${mutation.entity}.${mutation.op === 'delete' ? 'remove' : 'save'}`
  const failure = error instanceof RepositoryError ? error : toRepositoryError(error, operation)
  if (failure instanceof SupabaseRepositoryError) {
    // An expired or revoked session is not the record's fault: keep it queued until the user signs in.
    if (failure.kind === 'auth') return { outcome: 'retry', kind: 'session', error: failure.message }
    if (failure.retryable) {
      return { outcome: 'retry', kind: UNREACHABLE.has(failure.kind) ? 'unreachable' : 'busy', error: failure.message }
    }
    return { outcome: 'reject', error: failure.message }
  }
  return failure.retryable
    ? { outcome: 'retry', kind: 'busy', error: failure.message }
    : { outcome: 'reject', error: failure.message }
}

/** Sends one queued mutation (validated again right before it leaves the device). */
export async function sendMutation(remote: RemoteWriters, mutation: OutboxMutation): Promise<SendResult> {
  try {
    if (mutation.op === 'delete') await remote[mutation.entity].remove(mutation.recordId)
    else await upsertPayload(remote, mutation.entity, mutation.payload)
    return { outcome: 'sent' }
  } catch (error) {
    return classify(error, mutation)
  }
}
