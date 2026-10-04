import type { StoreValue } from 'idb'
import { openDatabase, type EntityStoreName, type NutritionistDB, type UserStoreName } from '@/lib/idb'
import { RepositoryError } from '@/repositories/types'
import {
  outboxMutationSchema,
  parseOwnedRecord,
  parseOwnedRecords,
  readOwner,
  RECORD_SPECS,
  validateForWrite,
  type RecordSpec,
} from '@/schemas'

/** Domain record type held by each user store. */
export type UserStoreRecord<S extends UserStoreName> = StoreValue<NutritionistDB, S>

/** Log scope for local storage warnings. */
const SCOPE = 'local-db'

/** Validation spec per IndexedDB store (the entity stores reuse `RECORD_SPECS`). */
export const STORE_SPECS: { [S in UserStoreName]: RecordSpec<UserStoreRecord<S>> } = {
  profiles: RECORD_SPECS.profiles,
  foods: RECORD_SPECS.food_items,
  meals: RECORD_SPECS.meal_logs,
  weights: RECORD_SPECS.weight_logs,
  workouts: RECORD_SPECS.workout_logs,
  scheduledWorkouts: RECORD_SPECS.scheduled_workouts,
  favorites: RECORD_SPECS.favorites,
  savedMeals: RECORD_SPECS.saved_meals,
  outbox: { label: 'outbox mutation', schema: outboxMutationSchema, ownerField: 'userId' },
}

/** Validated stored records of `userId` (see `parseOwnedRecords`); warnings use the `local-db` scope. */
export function parseStoredList<T>(spec: RecordSpec<T>, values: readonly unknown[], userId: string): T[] {
  return parseOwnedRecords(spec, values, userId, SCOPE)
}

/** One validated stored record of `userId`, or null when missing, invalid or owned by someone else. */
export function parseStored<T>(spec: RecordSpec<T>, value: unknown, userId: string): T | null {
  return parseOwnedRecord(spec, value, userId, SCOPE)
}

/** Runs a local storage operation; IndexedDB failures become non-retryable RepositoryErrors. */
export async function runLocal<T>(operation: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task()
  } catch (error) {
    if (error instanceof RepositoryError) throw error
    // DOMExceptions are not always `instanceof Error` (other realms), so read the name structurally.
    const name: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'name') : undefined
    const reason = typeof name === 'string' && name ? name : 'UnknownError'
    throw new RepositoryError(`Local storage could not complete ${operation} (${reason})`, {
      retryable: false,
      cause: error,
    })
  }
}

/**
 * Deletes a record by id when it belongs to `userId`. Missing records and records of another user
 * are left untouched (idempotent, never reveals other users' data). Invalid records can be removed.
 */
export async function removeOwned(store: Exclude<EntityStoreName, 'profiles'>, id: string, userId: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(store, 'readwrite')
  const existing: unknown = await tx.store.get(id)
  if (readOwner(existing, STORE_SPECS[store].ownerField) === userId) await tx.store.delete(id)
  await tx.done
}

/** Validates (see `validateForWrite`) and upserts a record into `store`; returns the stored record. */
export async function saveOwned<S extends UserStoreName>(
  store: S,
  record: UserStoreRecord<S>,
  userId: string,
): Promise<UserStoreRecord<S>> {
  const valid = validateForWrite(STORE_SPECS[store], record, userId)
  const db = await openDatabase()
  await db.put(store, valid)
  return valid
}
