import type {
  Favorite,
  FoodItem,
  MealEntry,
  Profile,
  SavedMeal,
  ScheduledWorkout,
  WeightEntry,
  WorkoutEntry,
} from '@/types'

/**
 * Repository contracts. The UI, stores and domain logic depend ONLY on these
 * interfaces — never on IndexedDB or Supabase directly.
 *
 * Every repository instance is bound to one user (the guest id or the
 * authenticated user id) at construction time, so methods never take a user id.
 * `save` is an idempotent upsert keyed by the record's client-generated UUID.
 */

/** Inclusive local-date range (YYYY-MM-DD). */
export interface DateRange {
  from: string
  to: string
}

export interface ProfileRepository {
  get(): Promise<Profile | null>
  save(profile: Profile): Promise<Profile>
}

/** User-owned foods: custom foods and saved provider foods. System foods live in the bundled catalog. */
export interface FoodRepository {
  list(): Promise<FoodItem[]>
  getById(id: string): Promise<FoodItem | null>
  save(food: FoodItem): Promise<FoodItem>
  remove(id: string): Promise<void>
}

export interface MealRepository {
  listByDate(date: string): Promise<MealEntry[]>
  listRange(range: DateRange): Promise<MealEntry[]>
  /** Most recently logged entries across all dates, newest first. */
  listRecent(limit: number): Promise<MealEntry[]>
  save(entry: MealEntry): Promise<MealEntry>
  remove(id: string): Promise<void>
}

export interface WeightRepository {
  /** All weigh-ins, unsorted order not guaranteed — callers sort via the weight engine. */
  list(): Promise<WeightEntry[]>
  save(entry: WeightEntry): Promise<WeightEntry>
  remove(id: string): Promise<void>
}

export interface WorkoutRepository {
  listRange(range: DateRange): Promise<WorkoutEntry[]>
  save(entry: WorkoutEntry): Promise<WorkoutEntry>
  remove(id: string): Promise<void>
}

export interface ScheduledWorkoutRepository {
  listRange(range: DateRange): Promise<ScheduledWorkout[]>
  save(entry: ScheduledWorkout): Promise<ScheduledWorkout>
  remove(id: string): Promise<void>
}

export interface FavoriteRepository {
  list(): Promise<Favorite[]>
  save(favorite: Favorite): Promise<Favorite>
  remove(id: string): Promise<void>
}

export interface SavedMealRepository {
  list(): Promise<SavedMeal[]>
  save(meal: SavedMeal): Promise<SavedMeal>
  remove(id: string): Promise<void>
}

export interface Repositories {
  /** The user every repository is bound to. */
  userId: string
  profile: ProfileRepository
  foods: FoodRepository
  meals: MealRepository
  weights: WeightRepository
  workouts: WorkoutRepository
  scheduledWorkouts: ScheduledWorkoutRepository
  favorites: FavoriteRepository
  savedMeals: SavedMealRepository
}

/** Error raised by repositories; `retryable` tells the sync layer whether to queue and retry. */
export class RepositoryError extends Error {
  readonly retryable: boolean
  override readonly cause: unknown

  constructor(message: string, options: { retryable: boolean; cause?: unknown }) {
    super(message)
    this.name = 'RepositoryError'
    this.retryable = options.retryable
    this.cause = options.cause
  }
}
