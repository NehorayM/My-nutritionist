import { isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import { SupabaseRepositoryError, toRepositoryError } from '@/repositories/supabase'
import { RepositoryError } from '@/repositories/types'
import { RECORD_SPECS, recordIdOf, validateForWrite, type EntityRecordMap } from '@/schemas'
import type { ConnectivityMonitor } from '@/services/sync/connectivity'
import type { Outbox } from '@/services/sync/outbox'
import type { SyncEngine } from '@/services/sync/syncTypes'
import type { SyncEntity } from '@/types'
import { refreshCache, type ScopeKeys } from './cache'

/** What synced repositories need from the sync layer. */
export interface SyncedContext {
  userId: string
  outbox: Pick<Outbox, 'enqueue' | 'ackMark' | 'ackedSince'>
  engine: Pick<SyncEngine, 'requestFlush'>
  connectivity: Pick<ConnectivityMonitor, 'getState' | 'verify'>
}

export interface ReadSpec<E extends SyncEntity, R> {
  operation: string
  entity: E
  /** The server's records for this read (throws `RepositoryError`s). */
  fetch: () => Promise<EntityRecordMap[E][]>
  scope: ScopeKeys<EntityRecordMap[E]>
  /** The answer, read from the (refreshed) local cache. */
  local: () => Promise<R>
}

async function isConnected(connectivity: SyncedContext['connectivity']): Promise<boolean> {
  const state = connectivity.getState()
  return (state === 'checking' ? await connectivity.verify() : state) === 'connected'
}

/** Errors after which the cache is served instead: unreachable/busy server, or a session that needs renewal. */
function servesCache(error: RepositoryError): boolean {
  return error.retryable || (error instanceof SupabaseRepositoryError && error.kind === 'auth')
}

/**
 * Read-through: when connected, fetch from Supabase, refresh the cache for the read's scope (pending
 * local changes win) and answer from the cache; otherwise — or when the server cannot be reached —
 * answer from the cache. Other server errors (invalid request, permission) are thrown.
 */
export async function readThrough<E extends SyncEntity, R>(ctx: SyncedContext, spec: ReadSpec<E, R>): Promise<R> {
  if (!(await isConnected(ctx.connectivity))) return spec.local()
  const mark = ctx.outbox.ackMark()
  let server: EntityRecordMap[E][]
  try {
    server = await spec.fetch()
  } catch (error) {
    const failure = error instanceof RepositoryError ? error : toRepositoryError(error, spec.operation)
    if (!servesCache(failure)) throw failure
    logger.info('synced', `${spec.operation} is served from this device: ${failure.message}`)
    if (failure.retryable) void ctx.connectivity.verify()
    return spec.local()
  }
  const acked = ctx.outbox.ackedSince(mark)
  // Without the acknowledgement history the refresh could resurrect stale data; the cache is still correct.
  if (acked !== null) await refreshCache({ userId: ctx.userId, entity: spec.entity, server, scope: spec.scope, acked })
  return spec.local()
}

export interface SyncedWriter<T> {
  save(record: T): Promise<T>
  remove(id: string): Promise<void>
}

/**
 * Writes go to the local cache and the outbox in one transaction, then a flush is requested; they
 * return without waiting for the network. Invalid or foreign records are rejected (non-retryable).
 */
export function syncedWriter<E extends SyncEntity>(ctx: SyncedContext, entity: E): SyncedWriter<EntityRecordMap[E]> {
  return {
    async save(record) {
      const valid = validateForWrite(RECORD_SPECS[entity], record, ctx.userId)
      await ctx.outbox.enqueue(
        { entity, op: 'upsert', recordId: recordIdOf(entity, valid), payload: valid },
        { mirrorToCache: true },
      )
      ctx.engine.requestFlush()
      return valid
    },
    async remove(id) {
      // Every stored record has a UUID, so any other id cannot exist locally or on the server.
      if (!isUuid(id)) return
      await ctx.outbox.enqueue({ entity, op: 'delete', recordId: id, payload: null }, { mirrorToCache: true })
      ctx.engine.requestFlush()
    },
  }
}
