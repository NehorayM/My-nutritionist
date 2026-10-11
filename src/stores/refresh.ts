import type { SyncEntity } from '@/types'
import { useActivityStore } from './activityStore'
import { useFoodLibraryStore } from './foodLibraryStore'
import { useKitchenStore } from './kitchenStore'
import { useMealsStore } from './mealsStore'
import { useProfileStore } from './profileStore'
import { useRemindersStore } from './remindersStore'
import { useWeightStore } from './weightStore'

const profile = () => useProfileStore.getState().refresh()
const library = () => useFoodLibraryStore.getState().refresh()
const meals = () => useMealsStore.getState().refresh()
const weights = () => useWeightStore.getState().refresh()
const activity = () => useActivityStore.getState().refresh()
const kitchen = () => useKitchenStore.getState().refresh()
const reminders = () => useRemindersStore.getState().refresh()

/** Which store shows each table's data (only stores that were loaded actually reload). */
const REFRESHERS: Record<SyncEntity, () => Promise<void>> = {
  profiles: profile,
  food_items: library,
  favorites: library,
  saved_meals: library,
  meal_logs: meals,
  weight_logs: weights,
  workout_logs: activity,
  scheduled_workouts: activity,
  pantry_items: kitchen,
  planner_settings: kitchen,
  reminder_schedules: reminders,
}

/**
 * Reloads the loaded stores that show `entities` (each store once). Loads overlay this tab's own recent
 * changes (see `ChangeJournal`), so a refresh never undoes an edit that is still being saved.
 */
export async function refreshStores(entities: readonly SyncEntity[]): Promise<void> {
  const refreshers = new Set(entities.map((entity) => REFRESHERS[entity]))
  await Promise.all([...refreshers].map((refresh) => refresh()))
}
