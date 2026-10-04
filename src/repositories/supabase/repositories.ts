import type {
  DateRange,
  FavoriteRepository,
  FoodRepository,
  MealRepository,
  ProfileRepository,
  SavedMealRepository,
  ScheduledWorkoutRepository,
  WeightRepository,
  WorkoutRepository,
} from '@/repositories/types'
import { checkDateRange, normalizeLimit } from '@/schemas'
import type { MealEntry, ScheduledWorkout, WorkoutEntry } from '@/types'
import type { OrderBy, RemoteTable, RemoteTables } from './remoteTable'

/**
 * Repository contracts implemented on top of `RemoteTable`s. Orderings match the IndexedDB
 * repositories: meals by date → logged time → id; workouts by date → id; lists by id;
 * `listRecent` newest `logged_at` first (ties: higher id first).
 */
const asc = (column: string): OrderBy => ({ column, ascending: true })
const desc = (column: string): OrderBy => ({ column, ascending: false })

/** Records within an inclusive date range; empty ranges (`from` after `to`) cost no request. */
async function inRange<T>(table: RemoteTable<T>, range: DateRange, orderBy: readonly OrderBy[]): Promise<T[]> {
  const bounds = checkDateRange(range)
  return bounds ? table.select({ dateRange: bounds, orderBy }) : []
}

export function createSupabaseProfileRepository(tables: RemoteTables, userId: string): ProfileRepository {
  return {
    get: () => tables.profiles.getById(userId),
    save: (profile) => tables.profiles.upsert(profile),
  }
}

/** The user's own foods only (`created_by = user`); system foods come from the bundled catalog. */
export function createSupabaseFoodRepository(tables: RemoteTables): FoodRepository {
  const table = tables.food_items
  return {
    list: () => table.select(),
    getById: (id) => table.getById(id),
    save: (food) => table.upsert(food),
    remove: (id) => table.remove(id),
  }
}

export function createSupabaseMealRepository(tables: RemoteTables): MealRepository {
  const table: RemoteTable<MealEntry> = tables.meal_logs
  const chronological = [asc('log_date'), asc('logged_at'), asc('id')]
  return {
    listByDate: (date) => inRange(table, { from: date, to: date }, chronological),
    listRange: (range) => inRange(table, range, chronological),
    listRecent: async (limit) => {
      const max = normalizeLimit(limit)
      return max === 0 ? [] : table.select({ orderBy: [desc('logged_at'), desc('id')], limit: max })
    },
    save: (entry) => table.upsert(entry),
    remove: (id) => table.remove(id),
  }
}

export function createSupabaseWeightRepository(tables: RemoteTables): WeightRepository {
  const table = tables.weight_logs
  return {
    list: () => table.select(),
    save: (entry) => table.upsert(entry),
    remove: (id) => table.remove(id),
  }
}

export function createSupabaseWorkoutRepository(tables: RemoteTables): WorkoutRepository {
  const table: RemoteTable<WorkoutEntry> = tables.workout_logs
  return {
    listRange: (range) => inRange(table, range, [asc('workout_date'), asc('id')]),
    save: (entry) => table.upsert(entry),
    remove: (id) => table.remove(id),
  }
}

export function createSupabaseScheduledWorkoutRepository(tables: RemoteTables): ScheduledWorkoutRepository {
  const table: RemoteTable<ScheduledWorkout> = tables.scheduled_workouts
  return {
    listRange: (range) => inRange(table, range, [asc('scheduled_date'), asc('id')]),
    save: (entry) => table.upsert(entry),
    remove: (id) => table.remove(id),
  }
}

export function createSupabaseFavoriteRepository(tables: RemoteTables): FavoriteRepository {
  const table = tables.favorites
  return {
    list: () => table.select(),
    save: (favorite) => table.upsert(favorite),
    remove: (id) => table.remove(id),
  }
}

export function createSupabaseSavedMealRepository(tables: RemoteTables): SavedMealRepository {
  const table = tables.saved_meals
  return {
    list: () => table.select(),
    save: (meal) => table.upsert(meal),
    remove: (id) => table.remove(id),
  }
}
