import { openDatabase } from '@/lib/idb'
import type {
  FavoriteRepository,
  FoodRepository,
  ProfileRepository,
  SavedMealRepository,
} from '@/repositories/types'
import { parseStored, parseStoredList, removeOwned, runLocal, saveOwned, STORE_SPECS } from './core'

export function createLocalProfileRepository(userId: string): ProfileRepository {
  const spec = STORE_SPECS.profiles
  return {
    get: () =>
      runLocal('profile.get', async () => {
        const db = await openDatabase()
        return parseStored(spec, await db.get('profiles', userId), userId)
      }),
    save: (profile) => runLocal('profile.save', () => saveOwned('profiles', profile, userId)),
  }
}

/** The user's own foods (custom + saved provider foods). System foods cannot be saved here. */
export function createLocalFoodRepository(userId: string): FoodRepository {
  const spec = STORE_SPECS.foods
  return {
    list: () =>
      runLocal('foods.list', async () => {
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('foods', 'byUser', userId), userId)
      }),
    getById: (id) =>
      runLocal('foods.getById', async () => {
        const db = await openDatabase()
        return parseStored(spec, await db.get('foods', id), userId)
      }),
    save: (food) => runLocal('foods.save', () => saveOwned('foods', food, userId)),
    remove: (id) => runLocal('foods.remove', () => removeOwned('foods', id, userId)),
  }
}

export function createLocalFavoriteRepository(userId: string): FavoriteRepository {
  const spec = STORE_SPECS.favorites
  return {
    list: () =>
      runLocal('favorites.list', async () => {
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('favorites', 'byUser', userId), userId)
      }),
    save: (favorite) => runLocal('favorites.save', () => saveOwned('favorites', favorite, userId)),
    remove: (id) => runLocal('favorites.remove', () => removeOwned('favorites', id, userId)),
  }
}

export function createLocalSavedMealRepository(userId: string): SavedMealRepository {
  const spec = STORE_SPECS.savedMeals
  return {
    list: () =>
      runLocal('savedMeals.list', async () => {
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('savedMeals', 'byUser', userId), userId)
      }),
    save: (meal) => runLocal('savedMeals.save', () => saveOwned('savedMeals', meal, userId)),
    remove: (id) => runLocal('savedMeals.remove', () => removeOwned('savedMeals', id, userId)),
  }
}
