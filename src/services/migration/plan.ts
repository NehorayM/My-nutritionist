import { favoriteId, userFoodId } from '@/lib/id'
import type {
  Favorite,
  FoodItem,
  FoodPortion,
  MealEntry,
  Profile,
  SavedMeal,
  ScheduledWorkout,
  WeightEntry,
  WorkoutEntry,
} from '@/types'

/** Kinds of guest data, in the order they are imported (foods before what references them). */
export const MIGRATION_KINDS = [
  'profile',
  'foods',
  'meals',
  'favorites',
  'savedMeals',
  'weights',
  'workouts',
  'scheduledWorkouts',
] as const
export type MigrationKind = (typeof MIGRATION_KINDS)[number]
export type MigrationCounts = Record<MigrationKind, number>

export function emptyCounts(): MigrationCounts {
  return { profile: 0, foods: 0, meals: 0, favorites: 0, savedMeals: 0, weights: 0, workouts: 0, scheduledWorkouts: 0 }
}

export interface GuestData {
  profile: Profile | null
  foods: FoodItem[]
  meals: MealEntry[]
  favorites: Favorite[]
  savedMeals: SavedMeal[]
  weights: WeightEntry[]
  workouts: WorkoutEntry[]
  scheduledWorkouts: ScheduledWorkout[]
}

/** Guest records re-keyed for the account, plus how many guest records were left out (and why). */
export interface MigrationPlan extends GuestData {
  /** Duplicates after re-keying, and favorites of foods that no longer exist. */
  dropped: MigrationCounts
}

export interface PlanOptions {
  userId: string
  /** Stamped as `updatedAt` on every imported record (so it wins over older server copies). */
  nowIso: string
  /** True for ids of bundled system foods (they exist on the server for every account). */
  isSystemFood: (foodId: string) => boolean
  /**
   * Ids of foods the account already has. References to them are kept — e.g. custom foods moved by an
   * earlier, interrupted import (they keep their id, so they are no longer guest records).
   */
  accountFoodIds?: ReadonlySet<string>
}

const PROVIDER_SOURCES: ReadonlySet<FoodItem['source']> = new Set(['usda', 'off'])

/** Keeps the first record per id; returns the kept records and how many were dropped. */
function uniqueById<T extends { id: string }>(records: readonly T[]): [T[], number] {
  const byId = new Map<string, T>()
  for (const record of records) if (!byId.has(record.id)) byId.set(record.id, record)
  return [[...byId.values()], records.length - byId.size]
}

/**
 * Re-keys guest records to the account: owner ids become `userId`, `updatedAt` becomes `nowIso`;
 * custom foods keep their ids, saved provider foods get `userFoodId(userId, source, externalId)` and
 * every reference follows (meal entries, favorites — whose ids are re-derived with `favoriteId` —
 * and saved-meal items). References to foods that exist neither among the guest's foods, the
 * account's foods nor the system catalog are cleared (the nutrition snapshot keeps the entry
 * meaningful, and the database would reject the dangling reference); favorites of such foods are
 * dropped and counted.
 */
export async function planGuestMigration(data: GuestData, options: PlanOptions): Promise<MigrationPlan> {
  const { userId, nowIso } = options
  const dropped = emptyCounts()
  const restamp = { updatedAt: nowIso }

  const rekeyedFoods = await Promise.all(
    data.foods.map(async (food) => {
      const id =
        PROVIDER_SOURCES.has(food.source) && food.externalId !== null
          ? await userFoodId(userId, food.source, food.externalId)
          : food.id
      return { from: food.id, food: { ...food, id, createdBy: userId, ...restamp } }
    }),
  )
  const idMap = new Map(rekeyedFoods.map(({ from, food }) => [from, food.id]))
  const [foods, duplicateFoods] = uniqueById(rekeyedFoods.map(({ food }) => food))
  dropped.foods = duplicateFoods
  const knownFoods = new Set([...(options.accountFoodIds ?? []), ...foods.map((food) => food.id)])

  const resolveFood = (foodId: string | null): string | null => {
    if (foodId === null) return null
    const mapped = idMap.get(foodId) ?? foodId
    return knownFoods.has(mapped) || options.isSystemFood(mapped) ? mapped : null
  }
  const portion = <P extends FoodPortion>(item: P): P => ({ ...item, foodId: resolveFood(item.foodId) })

  const favoriteCandidates = await Promise.all(
    data.favorites.map(async (favorite) => {
      const foodId = resolveFood(favorite.foodId)
      return foodId === null ? null : { ...favorite, id: await favoriteId(userId, foodId), userId, foodId, ...restamp }
    }),
  )
  const linkedFavorites = favoriteCandidates.filter((favorite) => favorite !== null)
  const [favorites, duplicateFavorites] = uniqueById(linkedFavorites)
  dropped.favorites = data.favorites.length - linkedFavorites.length + duplicateFavorites

  return {
    profile: data.profile ? { ...data.profile, userId, ...restamp } : null,
    foods,
    meals: data.meals.map((meal) => ({ ...portion(meal), userId, ...restamp })),
    favorites,
    savedMeals: data.savedMeals.map((meal) => ({ ...meal, userId, items: meal.items.map(portion), ...restamp })),
    weights: data.weights.map((entry) => ({ ...entry, userId, ...restamp })),
    workouts: data.workouts.map((entry) => ({ ...entry, userId, ...restamp })),
    scheduledWorkouts: data.scheduledWorkouts.map((entry) => ({ ...entry, userId, ...restamp })),
    dropped,
  }
}
