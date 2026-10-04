import { deleteDB, openDB, type DBSchema, type IDBPDatabase, type StoreNames } from 'idb'
import type {
  Favorite,
  FoodItem,
  MealEntry,
  OutboxMutation,
  Profile,
  SavedMeal,
  ScheduledWorkout,
  SyncEntity,
  WeightEntry,
  WorkoutEntry,
} from '@/types'
import { logger } from './logger'

/**
 * IndexedDB access (via `idb`). Only `repositories/local/*` and the sync layer use this module.
 * Records are stored in their domain shape; repositories validate them on read.
 */
export const DB_NAME = 'my-nutritionist'
export const DB_VERSION = 1

/** Free-form key/value record (sync cursors, migration flags). User-scoped keys: see `userMetaKey`. */
export interface MetaRecord {
  key: string
  value: unknown
}

/** Compound index key `[userId, date | timestamp]`. */
type UserKey = [string, string]

export interface NutritionistDB extends DBSchema {
  profiles: { key: string; value: Profile }
  /** User foods only; `byUser` indexes `createdBy`. */
  foods: { key: string; value: FoodItem; indexes: { byUser: string } }
  meals: {
    key: string
    value: MealEntry
    indexes: { byUser: string; byUserDate: UserKey; byUserLoggedAt: UserKey }
  }
  weights: { key: string; value: WeightEntry; indexes: { byUser: string } }
  workouts: { key: string; value: WorkoutEntry; indexes: { byUserDate: UserKey } }
  scheduledWorkouts: { key: string; value: ScheduledWorkout; indexes: { byUserDate: UserKey } }
  favorites: { key: string; value: Favorite; indexes: { byUser: string } }
  savedMeals: { key: string; value: SavedMeal; indexes: { byUser: string } }
  outbox: { key: string; value: OutboxMutation; indexes: { byUserCreated: UserKey } }
  meta: { key: string; value: MetaRecord }
}

export type NutritionistDatabase = IDBPDatabase<NutritionistDB>
export type StoreName = StoreNames<NutritionistDB>

/** Stores that hold user-owned records (everything except `meta`). */
export const USER_STORES = [
  'profiles',
  'foods',
  'meals',
  'weights',
  'workouts',
  'scheduledWorkouts',
  'favorites',
  'savedMeals',
  'outbox',
] as const satisfies readonly StoreName[]
export type UserStoreName = (typeof USER_STORES)[number]
export type EntityStoreName = Exclude<UserStoreName, 'outbox'>

/** Object store that caches each synchronizable table. */
export const STORE_FOR_ENTITY = {
  profiles: 'profiles',
  food_items: 'foods',
  meal_logs: 'meals',
  weight_logs: 'weights',
  workout_logs: 'workouts',
  scheduled_workouts: 'scheduledWorkouts',
  favorites: 'favorites',
  saved_meals: 'savedMeals',
} as const satisfies Record<SyncEntity, EntityStoreName>

/** Meta key owned by one user; `clearUserData(userId)` removes every key built with this helper. */
export function userMetaKey(userId: string, name: string): string {
  return `${userId}:${name}`
}

/** Key range covering every `userMetaKey(userId, …)`. */
export function userMetaKeyRange(userId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${userId}:`, `${userId}:￿`)
}

/** Key range covering every `[userId, …]` compound key (arrays sort after strings in IndexedDB). */
export function userCompoundRange(userId: string): IDBKeyRange {
  return IDBKeyRange.bound([userId], [userId, []])
}

function upgradeDatabase(db: NutritionistDatabase, oldVersion: number): void {
  // Version ladder: append `if (oldVersion < N)` blocks for future schema changes; never edit old ones.
  if (oldVersion < 1) {
    db.createObjectStore('profiles', { keyPath: 'userId' })
    db.createObjectStore('foods', { keyPath: 'id' }).createIndex('byUser', 'createdBy')
    const meals = db.createObjectStore('meals', { keyPath: 'id' })
    meals.createIndex('byUser', 'userId')
    meals.createIndex('byUserDate', ['userId', 'date'])
    meals.createIndex('byUserLoggedAt', ['userId', 'loggedAt'])
    db.createObjectStore('weights', { keyPath: 'id' }).createIndex('byUser', 'userId')
    db.createObjectStore('workouts', { keyPath: 'id' }).createIndex('byUserDate', ['userId', 'date'])
    db.createObjectStore('scheduledWorkouts', { keyPath: 'id' }).createIndex('byUserDate', ['userId', 'date'])
    db.createObjectStore('favorites', { keyPath: 'id' }).createIndex('byUser', 'userId')
    db.createObjectStore('savedMeals', { keyPath: 'id' }).createIndex('byUser', 'userId')
    db.createObjectStore('outbox', { keyPath: 'id' }).createIndex('byUserCreated', ['userId', 'createdAt'])
    db.createObjectStore('meta', { keyPath: 'key' })
  }
}

let connection: Promise<NutritionistDatabase> | null = null

/**
 * Shared connection to the app database (opened once, reused by every caller).
 * - Another tab upgrading to a newer version → this connection closes itself so the upgrade can run;
 *   the next call reopens.
 * - The browser terminating the connection, or a failed open, resets the cache so the next call retries.
 */
export function openDatabase(): Promise<NutritionistDatabase> {
  if (connection) return connection
  const forget = (): void => {
    if (connection === opening) connection = null
  }
  const opening: Promise<NutritionistDatabase> = openDB<NutritionistDB>(DB_NAME, DB_VERSION, {
    upgrade: upgradeDatabase,
    blocked: () => logger.warn('idb', 'Database upgrade is waiting for other open tabs of the app to close'),
    blocking: () => {
      logger.info('idb', 'A newer app version needs the database; closing this connection')
      forget()
      void opening.then((db) => db.close())
    },
    terminated: () => {
      logger.warn('idb', 'Database connection was closed by the browser; it will reopen on next use')
      forget()
    },
  }).catch((error: unknown) => {
    forget()
    throw error
  })
  connection = opening
  return opening
}

/** Close the shared connection (no-op when none is open). */
export async function closeDatabase(): Promise<void> {
  const pending = connection
  connection = null
  if (!pending) return
  try {
    const db = await pending
    db.close()
  } catch {
    // Opening failed, so there is no connection to close.
  }
}

/** Close and delete the whole database (tests, full local reset). */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase()
  await deleteDB(DB_NAME, {
    blocked: () => logger.warn('idb', 'Database deletion is waiting for other open tabs of the app to close'),
  })
}
