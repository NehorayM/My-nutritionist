import { openDatabase } from '@/lib/idb'
import type {
  DateRange,
  ScheduledWorkoutRepository,
  WeightRepository,
  WorkoutRepository,
} from '@/repositories/types'
import { checkDateRange } from '@/schemas'
import { parseStoredList, removeOwned, runLocal, saveOwned, STORE_SPECS } from './core'

/** Inclusive `[userId, date]` key range, or null for an empty range. */
function userDateRange(userId: string, range: DateRange): IDBKeyRange | null {
  const bounds = checkDateRange(range)
  return bounds ? IDBKeyRange.bound([userId, bounds.from], [userId, bounds.to]) : null
}

export function createLocalWeightRepository(userId: string): WeightRepository {
  const spec = STORE_SPECS.weights
  return {
    list: () =>
      runLocal('weights.list', async () => {
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('weights', 'byUser', userId), userId)
      }),
    save: (entry) => runLocal('weights.save', () => saveOwned('weights', entry, userId)),
    remove: (id) => runLocal('weights.remove', () => removeOwned('weights', id, userId)),
  }
}

/** Results are ordered by date, then id. */
export function createLocalWorkoutRepository(userId: string): WorkoutRepository {
  const spec = STORE_SPECS.workouts
  return {
    listRange: (range) =>
      runLocal('workouts.listRange', async () => {
        const keys = userDateRange(userId, range)
        if (!keys) return []
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('workouts', 'byUserDate', keys), userId)
      }),
    save: (entry) => runLocal('workouts.save', () => saveOwned('workouts', entry, userId)),
    remove: (id) => runLocal('workouts.remove', () => removeOwned('workouts', id, userId)),
  }
}

/** Results are ordered by date, then id. */
export function createLocalScheduledWorkoutRepository(userId: string): ScheduledWorkoutRepository {
  const spec = STORE_SPECS.scheduledWorkouts
  return {
    listRange: (range) =>
      runLocal('scheduledWorkouts.listRange', async () => {
        const keys = userDateRange(userId, range)
        if (!keys) return []
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('scheduledWorkouts', 'byUserDate', keys), userId)
      }),
    save: (entry) =>
      runLocal('scheduledWorkouts.save', () => saveOwned('scheduledWorkouts', entry, userId)),
    remove: (id) => runLocal('scheduledWorkouts.remove', () => removeOwned('scheduledWorkouts', id, userId)),
  }
}
