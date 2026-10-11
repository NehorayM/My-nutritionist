import { openDatabase } from '@/lib/idb'
import type { PantryRepository, PlannerSettingsRepository, ReminderRepository } from '@/repositories/types'
import { parseStored, parseStoredList, removeOwned, runLocal, saveOwned, STORE_SPECS } from './core'

export function createLocalPantryRepository(userId: string): PantryRepository {
  const spec = STORE_SPECS.pantry
  return {
    list: () =>
      runLocal('pantry.list', async () => {
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('pantry', 'byUser', userId), userId)
      }),
    save: (item) => runLocal('pantry.save', () => saveOwned('pantry', item, userId)),
    remove: (id) => runLocal('pantry.remove', () => removeOwned('pantry', id, userId)),
  }
}

export function createLocalPlannerSettingsRepository(userId: string): PlannerSettingsRepository {
  const spec = STORE_SPECS.plannerSettings
  return {
    get: () =>
      runLocal('plannerSettings.get', async () => {
        const db = await openDatabase()
        return parseStored(spec, await db.get('plannerSettings', userId), userId)
      }),
    save: (settings) => runLocal('plannerSettings.save', () => saveOwned('plannerSettings', settings, userId)),
  }
}

export function createLocalReminderRepository(userId: string): ReminderRepository {
  const spec = STORE_SPECS.reminders
  return {
    list: () =>
      runLocal('reminders.list', async () => {
        const db = await openDatabase()
        return parseStoredList(spec, await db.getAllFromIndex('reminders', 'byUser', userId), userId)
      }),
    save: (schedule) => runLocal('reminders.save', () => saveOwned('reminders', schedule, userId)),
    remove: (id) => runLocal('reminders.remove', () => removeOwned('reminders', id, userId)),
  }
}
