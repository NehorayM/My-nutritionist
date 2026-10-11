import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { getRepositories, setRepositories } from '@/services/runtime'
import { resetUserStores } from './registry'
import { useRemindersStore, type ReminderInput } from './remindersStore'

const store = () => useRemindersStore.getState()
const lunch: ReminderInput = { kind: 'meal_log', mealType: 'lunch', localTime: '13:00', days: [0, 1, 2, 3, 4], timezone: 'Asia/Jerusalem', enabled: true, skipIfLogged: true }

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(createLocalRepositories(newId()))
  resetUserStores()
  await store().load()
})

afterEach(() => setRepositories(null))

describe('reminders store', () => {
  it('creates, edits, toggles, deletes and restores reminders, ordered by time', async () => {
    const created = await store().save(lunch)
    const water = await store().save({ ...lunch, kind: 'hydration', mealType: 'dinner', localTime: '10:00' })
    if (!created.ok || !water.ok) throw new Error('save failed')
    expect(water.value.mealType).toBeNull()
    expect(store().schedules.map((s) => s.localTime)).toEqual(['10:00', '13:00'])
    expect((await store().save({ ...lunch, localTime: '12:30' }, created.value.id)).ok).toBe(true)
    expect(await store().setEnabled(created.value.id, false)).toEqual({ ok: true })
    expect((await getRepositories().reminders.list()).find((s) => s.id === created.value.id)).toMatchObject({ localTime: '12:30', enabled: false })
    const removed = await store().remove(created.value.id)
    expect(store().schedules).toHaveLength(1)
    if (removed.ok) await store().restore(removed.value)
    expect(store().schedules).toHaveLength(2)
  })

  it('rejects reminders without days or with an unknown time zone', async () => {
    expect((await store().save({ ...lunch, days: [] })).ok).toBe(false)
    expect((await store().save({ ...lunch, timezone: 'Mars/Olympus' })).ok).toBe(false)
    expect(await getRepositories().reminders.list()).toEqual([])
  })
})
