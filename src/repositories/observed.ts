import type { SyncEntity } from '@/types'
import type { Repositories } from './types'

/** Table behind each repository of a `Repositories` set. */
export const ENTITY_OF_REPOSITORY = {
  profile: 'profiles',
  foods: 'food_items',
  meals: 'meal_logs',
  weights: 'weight_logs',
  workouts: 'workout_logs',
  scheduledWorkouts: 'scheduled_workouts',
  favorites: 'favorites',
  savedMeals: 'saved_meals',
  pantry: 'pantry_items',
  plannerSettings: 'planner_settings',
  reminders: 'reminder_schedules',
} as const satisfies Record<Exclude<keyof Repositories, 'userId'>, SyncEntity>

type RepositoryKey = keyof typeof ENTITY_OF_REPOSITORY

const WRITE_METHODS = ['save', 'remove'] as const

function observe<R extends object>(repository: R, entity: SyncEntity, onWrite: (entity: SyncEntity) => void): R {
  const observed = { ...repository } as Record<string, unknown>
  for (const method of WRITE_METHODS) {
    const original: unknown = Reflect.get(repository, method)
    if (typeof original !== 'function') continue
    observed[method] = async (...args: unknown[]) => {
      const result: unknown = await Reflect.apply(original, repository, args)
      onWrite(entity)
      return result
    }
  }
  return observed as R
}

/**
 * The same repositories, calling `onWrite(table)` after every successful save or remove (used to tell
 * other tabs that data changed). Reads and failures are untouched.
 */
export function observeWrites(repositories: Repositories, onWrite: (entity: SyncEntity) => void): Repositories {
  const result: Repositories = { ...repositories }
  for (const key of Object.keys(ENTITY_OF_REPOSITORY) as RepositoryKey[]) {
    Object.assign(result, { [key]: observe(repositories[key], ENTITY_OF_REPOSITORY[key], onWrite) })
  }
  return result
}
