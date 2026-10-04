import type { SupabaseClient } from '@supabase/supabase-js'
import type { Repositories } from '@/repositories/types'
import { toDataClient, type SupabaseDataClient } from './client'
import { createRemoteTables, type RemoteOptions } from './remoteTable'
import {
  createSupabaseFavoriteRepository,
  createSupabaseFoodRepository,
  createSupabaseMealRepository,
  createSupabaseProfileRepository,
  createSupabaseSavedMealRepository,
  createSupabaseScheduledWorkoutRepository,
  createSupabaseWeightRepository,
  createSupabaseWorkoutRepository,
} from './repositories'

/**
 * Supabase repositories bound to (client, signed-in user id). The client is a parameter so callers
 * decide when one exists (`lib/supabase.getSupabase()` returns null in Offline/Local mode) and tests
 * can pass a fake. Every query filters by the owner column in addition to RLS; reads validate rows
 * and skip invalid ones; failures are `SupabaseRepositoryError`s whose `retryable` flag drives the outbox.
 */
export function createSupabaseRepositories(
  client: SupabaseClient | SupabaseDataClient,
  userId: string,
  options: RemoteOptions = {},
): Repositories {
  const tables = createRemoteTables(toDataClient(client), userId, options)
  return {
    userId,
    profile: createSupabaseProfileRepository(tables, userId),
    foods: createSupabaseFoodRepository(tables),
    meals: createSupabaseMealRepository(tables),
    weights: createSupabaseWeightRepository(tables),
    workouts: createSupabaseWorkoutRepository(tables),
    scheduledWorkouts: createSupabaseScheduledWorkoutRepository(tables),
    favorites: createSupabaseFavoriteRepository(tables),
    savedMeals: createSupabaseSavedMealRepository(tables),
  }
}

export { toDataClient, type FilterQuery, type QueryResult, type SupabaseDataClient } from './client'
export {
  classifyError,
  REMOTE_ERROR_KINDS,
  SupabaseRepositoryError,
  toRepositoryError,
  type ErrorClassification,
  type RemoteErrorKind,
} from './errors'
export { TABLE_MAPPERS, type TableMapper, type TableMappers } from './mappers'
export {
  createRemoteTable,
  createRemoteTables,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  type OrderBy,
  type RemoteOptions,
  type RemoteTable,
  type RemoteTables,
  type SelectOptions,
} from './remoteTable'
