import type { SupabaseClient } from '@supabase/supabase-js'
import { createLocalRepositories } from '@/repositories/local'
import { createSupabaseRepositories, type RemoteOptions, type SupabaseDataClient } from '@/repositories/supabase'
import type { Repositories } from '@/repositories/types'
import { normalizeLimit } from '@/schemas'
import { readThrough, syncedWriter, type SyncedContext } from './access'
import { dateScope, ownedFoodScope, profileScope, recentMealsScope, userScope } from './cache'

export interface SyncedRepositoriesOptions extends SyncedContext {
  client: SupabaseClient | SupabaseDataClient
  remoteOptions?: RemoteOptions
}

const asList = <T>(record: T | null): T[] => (record === null ? [] : [record])

/**
 * Cloud-mode repositories for the signed-in user: IndexedDB cache + outbox + Supabase.
 * - Writes: cache + outbox in one transaction, then `engine.requestFlush()`; they never wait for the network.
 * - Reads: when connected, fetch from Supabase and refresh the cache for that scope (queued local
 *   changes win, queued deletes stay hidden); offline or on retryable failures the cache answers.
 */
export function createSyncedRepositories(options: SyncedRepositoriesOptions): Repositories {
  const { userId } = options
  const ctx: SyncedContext = options
  const remote = createSupabaseRepositories(options.client, userId, options.remoteOptions)
  const cache = createLocalRepositories(userId)

  return {
    userId,
    profile: {
      get: () =>
        readThrough(ctx, {
          operation: 'profiles.get',
          entity: 'profiles',
          fetch: async () => asList(await remote.profile.get()),
          scope: profileScope(userId),
          local: () => cache.profile.get(),
        }),
      save: syncedWriter(ctx, 'profiles').save,
    },
    foods: {
      ...syncedWriter(ctx, 'food_items'),
      list: () =>
        readThrough(ctx, {
          operation: 'food_items.list',
          entity: 'food_items',
          fetch: () => remote.foods.list(),
          scope: userScope('foods', userId),
          local: () => cache.foods.list(),
        }),
      getById: (id) =>
        readThrough(ctx, {
          operation: 'food_items.get',
          entity: 'food_items',
          fetch: async () => asList(await remote.foods.getById(id)),
          scope: ownedFoodScope(userId, id),
          local: () => cache.foods.getById(id),
        }),
    },
    meals: {
      ...syncedWriter(ctx, 'meal_logs'),
      listByDate: (date) =>
        readThrough(ctx, {
          operation: 'meal_logs.list',
          entity: 'meal_logs',
          fetch: () => remote.meals.listByDate(date),
          scope: dateScope('meals', userId, { from: date, to: date }),
          local: () => cache.meals.listByDate(date),
        }),
      listRange: (range) =>
        readThrough(ctx, {
          operation: 'meal_logs.list',
          entity: 'meal_logs',
          fetch: () => remote.meals.listRange(range),
          scope: dateScope('meals', userId, range),
          local: () => cache.meals.listRange(range),
        }),
      listRecent: (limit) =>
        readThrough(ctx, {
          operation: 'meal_logs.listRecent',
          entity: 'meal_logs',
          fetch: () => remote.meals.listRecent(limit),
          scope: recentMealsScope(userId, normalizeLimit(limit)),
          local: () => cache.meals.listRecent(limit),
        }),
    },
    weights: {
      ...syncedWriter(ctx, 'weight_logs'),
      list: () =>
        readThrough(ctx, {
          operation: 'weight_logs.list',
          entity: 'weight_logs',
          fetch: () => remote.weights.list(),
          scope: userScope('weights', userId),
          local: () => cache.weights.list(),
        }),
    },
    workouts: {
      ...syncedWriter(ctx, 'workout_logs'),
      listRange: (range) =>
        readThrough(ctx, {
          operation: 'workout_logs.list',
          entity: 'workout_logs',
          fetch: () => remote.workouts.listRange(range),
          scope: dateScope('workouts', userId, range),
          local: () => cache.workouts.listRange(range),
        }),
    },
    scheduledWorkouts: {
      ...syncedWriter(ctx, 'scheduled_workouts'),
      listRange: (range) =>
        readThrough(ctx, {
          operation: 'scheduled_workouts.list',
          entity: 'scheduled_workouts',
          fetch: () => remote.scheduledWorkouts.listRange(range),
          scope: dateScope('scheduledWorkouts', userId, range),
          local: () => cache.scheduledWorkouts.listRange(range),
        }),
    },
    favorites: {
      ...syncedWriter(ctx, 'favorites'),
      list: () =>
        readThrough(ctx, {
          operation: 'favorites.list',
          entity: 'favorites',
          fetch: () => remote.favorites.list(),
          scope: userScope('favorites', userId),
          local: () => cache.favorites.list(),
        }),
    },
    savedMeals: {
      ...syncedWriter(ctx, 'saved_meals'),
      list: () =>
        readThrough(ctx, {
          operation: 'saved_meals.list',
          entity: 'saved_meals',
          fetch: () => remote.savedMeals.list(),
          scope: userScope('savedMeals', userId),
          local: () => cache.savedMeals.list(),
        }),
    },
  }
}

export { readThrough, syncedWriter, type ReadSpec, type SyncedContext, type SyncedWriter } from './access'
