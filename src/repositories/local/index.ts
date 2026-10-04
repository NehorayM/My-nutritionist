import type { Repositories } from '@/repositories/types'
import { createLocalScheduledWorkoutRepository, createLocalWeightRepository, createLocalWorkoutRepository } from './activity'
import {
  createLocalFavoriteRepository,
  createLocalFoodRepository,
  createLocalProfileRepository,
  createLocalSavedMealRepository,
} from './library'
import { createLocalMealRepository } from './meals'

/**
 * IndexedDB repositories bound to one user (guest id, or the signed-in user for the cloud cache).
 * Reads validate every record and skip invalid ones; writes reject invalid records and records owned
 * by another user with a non-retryable `RepositoryError`.
 */
export function createLocalRepositories(userId: string): Repositories {
  return {
    userId,
    profile: createLocalProfileRepository(userId),
    foods: createLocalFoodRepository(userId),
    meals: createLocalMealRepository(userId),
    weights: createLocalWeightRepository(userId),
    workouts: createLocalWorkoutRepository(userId),
    scheduledWorkouts: createLocalScheduledWorkoutRepository(userId),
    favorites: createLocalFavoriteRepository(userId),
    savedMeals: createLocalSavedMealRepository(userId),
  }
}

export {
  createLocalFavoriteRepository,
  createLocalFoodRepository,
  createLocalMealRepository,
  createLocalProfileRepository,
  createLocalSavedMealRepository,
  createLocalScheduledWorkoutRepository,
  createLocalWeightRepository,
  createLocalWorkoutRepository,
}
export { compareMealEntries } from './meals'
export {
  parseStored,
  parseStoredList,
  removeOwned,
  runLocal,
  saveOwned,
  STORE_SPECS,
  type UserStoreRecord,
} from './core'
export { clearUserData, countUserRecords, listAllForUser, type UserRecordCounts } from './userData'
export { deleteMeta, readMeta, writeMeta } from './meta'
