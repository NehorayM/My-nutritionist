import type { z } from 'zod'
import { logger } from '@/lib/logger'
import { RepositoryError, type DateRange } from '@/repositories/types'
import type { SyncEntity } from '@/types'
import { ENTITY_SCHEMAS, type EntityRecordMap } from './entities'
import { dateRangeSchema } from './primitives'

/**
 * Record validation shared by every repository implementation (IndexedDB, Supabase, synced).
 * - Reads: `parseOwnedRecords` keeps valid records of the bound user and skips the rest with a warning.
 * - Writes: `validateForWrite` rejects invalid or foreign records with a non-retryable `RepositoryError`.
 * Log lines and error messages name the record kind and failing field paths only — never values.
 */
export interface RecordSpec<T> {
  /** Human label for logs and errors (e.g. "meal entry"). */
  label: string
  schema: z.ZodType<T, unknown>
  /** Domain field holding the owning user id. */
  ownerField: 'userId' | 'createdBy'
}

export const RECORD_SPECS: { [E in SyncEntity]: RecordSpec<EntityRecordMap[E]> } = {
  profiles: { label: 'profile', schema: ENTITY_SCHEMAS.profiles, ownerField: 'userId' },
  food_items: { label: 'food', schema: ENTITY_SCHEMAS.food_items, ownerField: 'createdBy' },
  meal_logs: { label: 'meal entry', schema: ENTITY_SCHEMAS.meal_logs, ownerField: 'userId' },
  weight_logs: { label: 'weigh-in', schema: ENTITY_SCHEMAS.weight_logs, ownerField: 'userId' },
  workout_logs: { label: 'workout', schema: ENTITY_SCHEMAS.workout_logs, ownerField: 'userId' },
  scheduled_workouts: { label: 'scheduled workout', schema: ENTITY_SCHEMAS.scheduled_workouts, ownerField: 'userId' },
  favorites: { label: 'favorite', schema: ENTITY_SCHEMAS.favorites, ownerField: 'userId' },
  saved_meals: { label: 'saved meal', schema: ENTITY_SCHEMAS.saved_meals, ownerField: 'userId' },
}

/** Owner id of a value without trusting its shape; null when absent or not a string. */
export function readOwner(value: unknown, field: RecordSpec<unknown>['ownerField']): string | null {
  if (typeof value !== 'object' || value === null || !(field in value)) return null
  const owner: unknown = Reflect.get(value, field)
  return typeof owner === 'string' ? owner : null
}

/**
 * Validated records owned by `userId`, in input order. Values of another owner are ignored;
 * invalid values are skipped and counted in ONE warning under `scope` (no contents logged).
 */
export function parseOwnedRecords<T>(spec: RecordSpec<T>, values: readonly unknown[], userId: string, scope: string): T[] {
  const records: T[] = []
  let invalid = 0
  for (const value of values) {
    if (readOwner(value, spec.ownerField) !== userId) continue
    const parsed = spec.schema.safeParse(value)
    if (parsed.success) records.push(parsed.data)
    else invalid += 1
  }
  if (invalid > 0) logger.warn(scope, `Skipped ${invalid} invalid ${spec.label} record(s)`)
  return records
}

/** One validated record of `userId`, or null when missing, invalid (warned) or owned by someone else. */
export function parseOwnedRecord<T>(spec: RecordSpec<T>, value: unknown, userId: string, scope: string): T | null {
  if (value === undefined || value === null) return null
  return parseOwnedRecords(spec, [value], userId, scope)[0] ?? null
}

/** Dotted paths of the fields that failed validation, e.g. "per100g.calories, grams". */
export function invalidFieldPaths(error: z.ZodError): string {
  return [...new Set(error.issues.map((issue) => issue.path.map(String).join('.') || '(record)'))].join(', ')
}

/**
 * Checks a record before it is written. Throws a non-retryable `RepositoryError` when it belongs to
 * another user (system foods have no owner, so they are rejected too) or fails validation.
 * Returns the canonical parsed record (timestamps in UTC, unknown nutrients as `null`).
 */
export function validateForWrite<T>(spec: RecordSpec<T>, record: T, userId: string): T {
  if (readOwner(record, spec.ownerField) !== userId) {
    throw new RepositoryError(`Cannot save a ${spec.label} that belongs to a different user`, { retryable: false })
  }
  const parsed = spec.schema.safeParse(record)
  if (!parsed.success) {
    throw new RepositoryError(`Invalid ${spec.label}: check ${invalidFieldPaths(parsed.error)}`, {
      retryable: false,
      cause: parsed.error,
    })
  }
  return parsed.data
}

/**
 * Validated inclusive date range, or null when it is empty (`from` after `to`).
 * Throws a non-retryable `RepositoryError` when either end is not a real `YYYY-MM-DD` date.
 */
export function checkDateRange(range: DateRange): DateRange | null {
  const parsed = dateRangeSchema.safeParse(range)
  if (!parsed.success) {
    throw new RepositoryError('Date range must use real YYYY-MM-DD dates', { retryable: false, cause: parsed.error })
  }
  return parsed.data.from <= parsed.data.to ? parsed.data : null
}

/** Whole number of items to return: NaN or below 1 → 0; fractions round down; Infinity → no limit. */
export function normalizeLimit(limit: number): number {
  return Number.isNaN(limit) || limit < 1 ? 0 : Math.floor(limit)
}
