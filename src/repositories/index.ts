/**
 * Repository implementations. Feature code depends on the interfaces in `./types` and receives a
 * `Repositories` set from `services/runtime`; only bootstrap and the sync layer construct them.
 * - `createLocalRepositories(userId)`: IndexedDB (guest mode, and the local cache in cloud mode).
 * - `createSupabaseRepositories(client, userId)`: direct Supabase access (used by the synced layer).
 */
export { createLocalRepositories } from './local'
export { createSupabaseRepositories } from './supabase'
export {
  RepositoryError,
  type DateRange,
  type FavoriteRepository,
  type FoodRepository,
  type MealRepository,
  type ProfileRepository,
  type Repositories,
  type SavedMealRepository,
  type ScheduledWorkoutRepository,
  type WeightRepository,
  type WorkoutRepository,
} from './types'
