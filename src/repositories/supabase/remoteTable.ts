import { isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import type { DateRange } from '@/repositories/types'
import { normalizeLimit, readOwner, RECORD_SPECS, recordIdOf, validateForWrite, type EntityRecordMap } from '@/schemas'
import type { SyncEntity } from '@/types'
import type { FilterQuery, QueryResult, SupabaseDataClient } from './client'
import { SupabaseRepositoryError, toRepositoryError } from './errors'
import { TABLE_MAPPERS } from './mappers'

/** Log scope for skipped Supabase rows. */
const SCOPE = 'supabase-db'

export interface RemoteOptions {
  /** Each request is aborted after this many ms (a retryable `timeout` error). Default 15 000. */
  timeoutMs?: number
  /**
   * Rows requested per page when reading lists. Must not exceed the project's PostgREST `max_rows`
   * (Supabase default 1000), otherwise a short page would be mistaken for the last one.
   */
  pageSize?: number
}

export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_PAGE_SIZE = 1000

export interface OrderBy {
  column: string
  ascending: boolean
}

export interface SelectOptions {
  /** Inclusive range on the table's date column (the table must have one). */
  dateRange?: DateRange
  /** Sort order. It must end with a unique column (e.g. `id`) so pages never overlap. Default: id ascending. */
  orderBy?: readonly OrderBy[]
  /** Maximum number of valid records to return (default: all; see `normalizeLimit`). */
  limit?: number
}

/**
 * Generic access to one Supabase table for ONE user. Every query also filters by the owner column
 * (defense in depth on top of RLS); rows are validated with the entity schema and invalid ones are
 * skipped with a warning. Reused by the Supabase repositories and by the sync layer (outbox flush).
 */
export interface RemoteTable<T> {
  readonly entity: SyncEntity
  /** The user's record with this primary key, or null (also for non-UUID ids, without a request). */
  getById(id: string): Promise<T | null>
  select(options?: SelectOptions): Promise<T[]>
  /**
   * Validates, then upserts by `id` and returns the server's row. When the database's stale-write
   * guard skipped the write (the stored row is newer), returns the CURRENT server record instead.
   */
  upsert(record: T): Promise<T>
  /** Deletes the user's record with this id; missing records are not an error (idempotent). */
  remove(id: string): Promise<void>
}

/** Awaits a query and returns its data, converting every failure into a `RepositoryError`. */
async function execute(operation: string, query: PromiseLike<QueryResult>): Promise<unknown> {
  let result: QueryResult
  try {
    result = await query
  } catch (error) {
    throw toRepositoryError(error, operation)
  }
  if (result.error !== null && result.error !== undefined) throw toRepositoryError(result.error, operation, result.status)
  return result.data
}

function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  return data === null || data === undefined ? [] : [data]
}

export function createRemoteTable<E extends SyncEntity>(
  client: SupabaseDataClient,
  userId: string,
  entity: E,
  options: RemoteOptions = {},
): RemoteTable<EntityRecordMap[E]> {
  type Item = EntityRecordMap[E]
  const mapper = TABLE_MAPPERS[entity]
  const spec = RECORD_SPECS[entity]
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE))

  /** Selects the user's rows; `id` (when given) narrows to one primary key. */
  const query = (id?: string): FilterQuery => {
    let builder = client.from(entity).select('*')
    if (id !== undefined && mapper.ownerColumn !== 'id') builder = builder.eq('id', id)
    return builder.eq(mapper.ownerColumn, userId).abortSignal(AbortSignal.timeout(timeoutMs))
  }

  /** Valid records of the user among raw rows; invalid rows are counted in one warning. */
  const parseRows = (rows: readonly unknown[]): Item[] => {
    const records: Item[] = []
    let invalid = 0
    for (const row of rows) {
      const record = mapper.fromRow(row)
      if (record === null) invalid += 1
      else if (readOwner(record, spec.ownerField) === userId) records.push(record)
    }
    if (invalid > 0) logger.warn(SCOPE, `Skipped ${invalid} invalid ${spec.label} row(s) from ${entity}`)
    return records
  }

  const getById = async (id: string): Promise<Item | null> => {
    if (!isUuid(id) || (mapper.ownerColumn === 'id' && id !== userId)) return null
    const data = await execute(`${entity}.get`, query(id).limit(1))
    return parseRows(rowsOf(data))[0] ?? null
  }

  const select = async ({ dateRange, orderBy, limit }: SelectOptions = {}): Promise<Item[]> => {
    const max = limit === undefined ? Number.POSITIVE_INFINITY : normalizeLimit(limit)
    const order = orderBy ?? [{ column: 'id', ascending: true }]
    const records: Item[] = []
    let offset = 0
    while (records.length < max) {
      const size = Math.min(pageSize, max - records.length)
      let page = query()
      if (dateRange) {
        if (mapper.dateColumn === null) throw new TypeError(`${entity} has no date column`)
        page = page.gte(mapper.dateColumn, dateRange.from).lte(mapper.dateColumn, dateRange.to)
      }
      for (const { column, ascending } of order) page = page.order(column, { ascending })
      const rows = rowsOf(await execute(`${entity}.list`, page.range(offset, offset + size - 1)))
      records.push(...parseRows(rows))
      offset += rows.length
      if (rows.length < size) break
    }
    return records.slice(0, max)
  }

  const upsert = async (record: Item): Promise<Item> => {
    const valid = validateForWrite(spec, record, userId)
    const operation = `${entity}.save`
    const data = await execute(
      operation,
      client
        .from(entity)
        .upsert(mapper.toRow(valid), { onConflict: 'id' })
        .select('*')
        .abortSignal(AbortSignal.timeout(timeoutMs)),
    )
    const rows = rowsOf(data)
    if (rows.length === 0) {
      // guard_stale_write() skipped the update: the server already holds a newer version.
      const current = await getById(recordIdOf(entity, valid))
      if (current) return current
      throw new SupabaseRepositoryError(
        `Supabase ${operation} failed: the record conflicts with existing data`,
        { kind: 'conflict', retryable: false, code: null, status: null },
        null,
      )
    }
    // The write succeeded; if the echoed row is unreadable, the validated input is the best answer.
    return parseRows(rows)[0] ?? valid
  }

  const remove = async (id: string): Promise<void> => {
    if (!isUuid(id) || (mapper.ownerColumn === 'id' && id !== userId)) return
    let builder = client.from(entity).delete().eq('id', id)
    if (mapper.ownerColumn !== 'id') builder = builder.eq(mapper.ownerColumn, userId)
    await execute(`${entity}.remove`, builder.abortSignal(AbortSignal.timeout(timeoutMs)))
  }

  return { entity, getById, select, upsert, remove }
}

export type RemoteTables = { [E in SyncEntity]: RemoteTable<EntityRecordMap[E]> }

/** One `RemoteTable` per synchronizable table, all bound to `userId` (for the sync engine). */
export function createRemoteTables(client: SupabaseDataClient, userId: string, options: RemoteOptions = {}): RemoteTables {
  return {
    profiles: createRemoteTable(client, userId, 'profiles', options),
    food_items: createRemoteTable(client, userId, 'food_items', options),
    meal_logs: createRemoteTable(client, userId, 'meal_logs', options),
    weight_logs: createRemoteTable(client, userId, 'weight_logs', options),
    workout_logs: createRemoteTable(client, userId, 'workout_logs', options),
    scheduled_workouts: createRemoteTable(client, userId, 'scheduled_workouts', options),
    favorites: createRemoteTable(client, userId, 'favorites', options),
    saved_meals: createRemoteTable(client, userId, 'saved_meals', options),
  }
}
