import { create } from 'zustand'
import { newId } from '@/lib/id'
import { reminderScheduleSchema } from '@/schemas'
import { listRecentDeliveries } from '@/services/reminders'
import { getRepositories } from '@/services/runtime'
import type { ReminderDispatch, ReminderSchedule } from '@/types'
import { createChangeJournal } from './changeJournal'
import { userMessageFor } from './errors'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset, sessionGuard } from './registry'

/** What the user sets for an email reminder (ids, owner and timestamps come from the store). */
export type ReminderInput = Pick<ReminderSchedule, 'kind' | 'mealType' | 'localTime' | 'days' | 'timezone' | 'enabled' | 'skipIfLogged'>
export type ReminderResult = { ok: true; value: ReminderSchedule } | { ok: false; message: string }

interface RemindersState {
  /** By time of day. */
  schedules: ReminderSchedule[]
  status: LoadStatus
  error: string | null
  /** Recent deliveries (server records), newest first. */
  deliveries: ReminderDispatch[]
  deliveriesStatus: LoadStatus
  load: (options?: { force?: boolean }) => Promise<void>
  loadDeliveries: () => Promise<void>
  /** Creates a reminder, or updates `id`. */
  save: (input: ReminderInput, id?: string) => Promise<ReminderResult>
  setEnabled: (id: string, enabled: boolean) => Promise<SaveResult>
  /** Returns the removed reminder (for Undo). */
  remove: (id: string) => Promise<ReminderResult>
  restore: (schedule: ReminderSchedule) => Promise<SaveResult>
  refresh: () => Promise<void>
  reset: () => void
}

const initial = { schedules: [] as ReminderSchedule[], status: 'idle' as LoadStatus, error: null, deliveries: [] as ReminderDispatch[], deliveriesStatus: 'idle' as LoadStatus }
const journal = createChangeJournal<ReminderSchedule>()
const byTime = (a: ReminderSchedule, b: ReminderSchedule) => a.localTime.localeCompare(b.localTime) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
const INVALID = 'Please pick a time, at least one day and a time zone.'

export const useRemindersStore = create<RemindersState>()((set, get) => {
  function place(id: string, schedule: ReminderSchedule | null): void {
    journal.record(id, schedule)
    const rest = get().schedules.filter((existing) => existing.id !== id)
    set({ schedules: (schedule ? [...rest, schedule] : rest).sort(byTime) })
  }

  async function persist(schedule: ReminderSchedule, action: string): Promise<ReminderResult> {
    if (!reminderScheduleSchema.safeParse(schedule).success) return { ok: false, message: INVALID }
    const current = sessionGuard()
    const before = get().schedules.find((existing) => existing.id === schedule.id) ?? null
    place(schedule.id, schedule)
    try {
      const saved = await getRepositories().reminders.save(schedule)
      if (current()) place(saved.id, saved)
      return { ok: true, value: saved }
    } catch (error) {
      if (current()) place(schedule.id, before)
      return { ok: false, message: userMessageFor(error, action) }
    }
  }

  return {
    ...initial,

    async load(options = {}) {
      const { status } = get()
      if (!options.force && (status === 'ready' || status === 'loading')) return
      const current = sessionGuard()
      set({ status: 'loading', error: null })
      const mark = journal.mark()
      try {
        const loaded = await getRepositories().reminders.list()
        if (current()) set({ schedules: journal.overlay(loaded, mark).sort(byTime), status: 'ready' })
      } catch (error) {
        const message = userMessageFor(error, 'load your reminders')
        if (current()) set({ status: 'error', error: message })
      }
    },

    async loadDeliveries() {
      const current = sessionGuard()
      set({ deliveriesStatus: 'loading' })
      try {
        const deliveries = await listRecentDeliveries()
        if (current()) set({ deliveries, deliveriesStatus: 'ready' })
      } catch (error) {
        userMessageFor(error, 'load recent reminder emails')
        if (current()) set({ deliveriesStatus: 'error' })
      }
    },

    save(input, id) {
      const now = new Date().toISOString()
      const existing = id ? get().schedules.find((schedule) => schedule.id === id) : undefined
      const base = existing ?? { id: newId(), userId: getRepositories().userId, createdAt: now }
      const mealType = input.kind === 'meal_log' ? input.mealType : null
      return persist({ ...base, ...input, mealType, updatedAt: now }, existing ? 'update the reminder' : 'add the reminder')
    },

    async setEnabled(id, enabled) {
      const existing = get().schedules.find((schedule) => schedule.id === id)
      if (!existing) return { ok: false, message: 'This reminder no longer exists.' }
      const result = await persist({ ...existing, enabled, updatedAt: new Date().toISOString() }, 'update the reminder')
      return result.ok ? { ok: true } : result
    },

    async remove(id) {
      const before = get().schedules.find((schedule) => schedule.id === id)
      if (!before) return { ok: false, message: 'This reminder no longer exists.' }
      const current = sessionGuard()
      place(id, null)
      try {
        await getRepositories().reminders.remove(id)
        return { ok: true, value: before }
      } catch (error) {
        if (current()) place(id, before)
        return { ok: false, message: userMessageFor(error, 'remove the reminder') }
      }
    },

    async restore(schedule) {
      const result = await persist({ ...schedule, updatedAt: new Date().toISOString() }, 'restore the reminder')
      return result.ok ? { ok: true } : result
    },

    async refresh() {
      if (get().status !== 'idle') await get().load({ force: true })
      if (get().deliveriesStatus !== 'idle') await get().loadDeliveries()
    },

    reset() {
      journal.clear()
      set(initial)
    },
  }
})

registerUserStoreReset(() => useRemindersStore.getState().reset())
