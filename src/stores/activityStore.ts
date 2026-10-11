import { create } from 'zustand'
import { compareWorkouts, estimateWorkoutKcal, getWeekWindow, type CatchUpSuggestion } from '@/domain/activity'
import { addDays, compareDateKeys, todayKey } from '@/domain/dates'
import { newId } from '@/lib/id'
import type { DateRange } from '@/repositories/types'
import { LIMITS, scheduledWorkoutSchema, TEXT_LIMITS, workoutEntrySchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { ScheduledWorkout, WorkoutEntry } from '@/types'
import { userMessageFor } from './errors'
import { byDate, inRange, persist, replace, touch, type ListSpec, type Saved } from './activityLists'
import { createChangeJournal } from './changeJournal'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset, sessionGuard } from './registry'

/** What the user logs. `kcal` is what they typed; null → informational estimate from `weightKg` (if known). */
export type WorkoutInput = Pick<WorkoutEntry, 'date' | 'type' | 'durationMin' | 'intensity' | 'notes'> & {
  kcal: number | null
  weightKg: number | null
}

export type WorkoutResult = Saved<WorkoutEntry>

interface ActivityState {
  /** Loaded ranges: workouts from a week before this week (recovery spacing), scheduled sessions for this week. */
  window: { weekStart: string; workouts: DateRange; scheduled: DateRange } | null
  workouts: WorkoutEntry[]
  scheduled: ScheduledWorkout[]
  status: LoadStatus
  error: string | null
  /** Loads the week containing `today`; a no-op when that week is already loaded, unless `force`. */
  load: (today: string, weekStartsOn: 0 | 1, options?: { force?: boolean }) => Promise<void>
  logWorkout: (input: WorkoutInput) => Promise<WorkoutResult>
  updateWorkout: (id: string, input: WorkoutInput) => Promise<WorkoutResult>
  /** Deleting a workout that completed a scheduled session reopens that session. */
  deleteWorkout: (id: string) => Promise<SaveResult>
  /** Re-saves a deleted workout (undo) and re-links the session it completed. */
  restoreWorkout: (entry: WorkoutEntry) => Promise<SaveResult>
  scheduleSessions: (suggestions: readonly CatchUpSuggestion[]) => Promise<SaveResult>
  completeScheduled: (id: string, actual?: Partial<WorkoutInput>) => Promise<WorkoutResult>
  dismissScheduled: (id: string) => Promise<SaveResult>
  restoreScheduled: (session: ScheduledWorkout) => Promise<SaveResult> // undo of a skip
  /** Reloads the loaded week (data changed elsewhere); a no-op before the first load. */
  refresh: () => Promise<void>
  reset: () => void
}

const initial = { window: null, workouts: [], scheduled: [], status: 'idle' as LoadStatus, error: null }
let loadToken = 0
let lastLoad: { today: string; weekStartsOn: 0 | 1 } | null = null
const workoutJournal = createChangeJournal<WorkoutEntry>()
const scheduledJournal = createChangeJournal<ScheduledWorkout>()

function workoutFields(input: WorkoutInput): Omit<WorkoutEntry, 'id' | 'userId' | 'scheduledWorkoutId' | 'createdAt' | 'updatedAt'> {
  const notes = input.notes?.trim() || null
  const fields = { date: input.date, type: input.type, durationMin: input.durationMin, intensity: input.intensity, notes }
  if (input.kcal !== null) return { ...fields, estimatedKcal: Math.round(input.kcal), kcalSource: 'user' }
  const estimate = estimateWorkoutKcal(input)
  const known = estimate !== null && estimate <= LIMITS.workoutKcal.max
  return { ...fields, estimatedKcal: known ? estimate : null, kcalSource: known ? 'estimate' : null }
}

export const useActivityStore = create<ActivityState>()((set, get) => {
  const workouts: ListSpec<WorkoutEntry> = {
    list: () => get().workouts,
    apply: (list) => set({ workouts: list }),
    range: () => get().window?.workouts,
    save: (record) => getRepositories().workouts.save(record),
    valid: (record) => compareDateKeys(record.date, todayKey()) <= 0 && workoutEntrySchema.safeParse(record).success,
    order: compareWorkouts,
    invalid: 'Please check the workout: a date up to today and a duration of 1–600 minutes.',
    journal: workoutJournal,
  }
  const scheduled: ListSpec<ScheduledWorkout> = {
    list: () => get().scheduled,
    apply: (list) => set({ scheduled: list }),
    range: () => get().window?.scheduled,
    save: (record) => getRepositories().scheduledWorkouts.save(record),
    valid: (record) => scheduledWorkoutSchema.safeParse(record).success,
    order: byDate,
    invalid: "Couldn't save the session. Please try again.",
    journal: scheduledJournal,
  }

  const saveWorkout = (entry: WorkoutEntry, action: string) => persist(workouts, entry, action)
  const saveSession = (session: ScheduledWorkout, action: string) => persist(scheduled, session, action)

  function newWorkout(input: WorkoutInput, scheduledWorkoutId: string | null): WorkoutEntry {
    const now = new Date().toISOString()
    return { id: newId(), userId: getRepositories().userId, scheduledWorkoutId, createdAt: now, updatedAt: now, ...workoutFields(input) }
  }

  const linkedSession = (entry: WorkoutEntry) => get().scheduled.find((s) => s.id === entry.scheduledWorkoutId)

  return {
    ...initial,

    async load(today, weekStartsOn, options = {}) {
      lastLoad = { today, weekStartsOn }
      const week = getWeekWindow(today, weekStartsOn)
      const state = get()
      const sameWeek = state.window?.weekStart === week.start
      if (!options.force && sameWeek && state.status !== 'error') return
      const range = { from: week.start, to: week.end }
      const window = { weekStart: week.start, workouts: { ...range, from: addDays(week.start, -7) }, scheduled: range }
      const token = ++loadToken
      const sameSession = sessionGuard()
      const current = () => sameSession() && token === loadToken
      set({ window, status: 'loading', error: null, ...(sameWeek ? {} : { workouts: [], scheduled: [] }) })
      const marks = { workouts: workoutJournal.mark(), scheduled: scheduledJournal.mark() }
      try {
        const { workouts: logs, scheduledWorkouts: plans } = getRepositories()
        const [logged, planned] = await Promise.all([logs.listRange(window.workouts), plans.listRange(window.scheduled)])
        if (!current()) return
        const workoutList = workoutJournal.overlay(logged, marks.workouts, (w) => inRange(w.date, window.workouts))
        const sessionList = scheduledJournal.overlay(planned, marks.scheduled, (s) => inRange(s.date, window.scheduled))
        set({ workouts: workoutList.sort(compareWorkouts), scheduled: sessionList.sort(byDate), status: 'ready' })
      } catch (error) {
        const message = userMessageFor(error, 'load your activity')
        if (current()) set({ status: 'error', error: message })
      }
    },

    logWorkout: (input) => saveWorkout(newWorkout(input, null), 'save your workout'),
    async updateWorkout(id, input) {
      const existing = get().workouts.find((w) => w.id === id)
      if (!existing) return { ok: false, message: 'This workout is no longer available.' }
      return saveWorkout(touch({ ...existing, ...workoutFields(input) }), 'update the workout')
    },

    async deleteWorkout(id) {
      const entry = get().workouts.find((w) => w.id === id)
      if (!entry) return { ok: true }
      const current = sessionGuard()
      replace(workouts, id, null)
      try {
        await getRepositories().workouts.remove(id)
      } catch (error) {
        if (current()) replace(workouts, id, entry)
        return { ok: false, message: userMessageFor(error, 'delete the workout') }
      }
      const session = linkedSession(entry)
      if (session?.completedWorkoutId !== id) return { ok: true }
      return saveSession(touch({ ...session, status: 'planned', completedWorkoutId: null }), 'reopen the session')
    },

    async restoreWorkout(entry) {
      const result = await saveWorkout(touch(entry), 'restore the workout')
      const session = linkedSession(entry)
      if (!result.ok || session?.status !== 'planned') return result
      return saveSession(touch({ ...session, status: 'completed', completedWorkoutId: entry.id }), 'update the session')
    },

    async scheduleSessions(suggestions) {
      const now = new Date().toISOString()
      const base = { userId: getRepositories().userId, status: 'planned', source: 'catch_up', completedWorkoutId: null, createdAt: now, updatedAt: now } as const
      for (const { date, type, durationMin, intensity, rationale } of suggestions) {
        const text = rationale.slice(0, TEXT_LIMITS.scheduledRationale)
        const result = await saveSession({ ...base, id: newId(), date, type, durationMin, intensity, rationale: text }, 'schedule the sessions')
        if (!result.ok) return result
      }
      return { ok: true }
    },

    async completeScheduled(id, actual = {}) {
      const session = get().scheduled.find((s) => s.id === id)
      if (session?.status !== 'planned') return { ok: false, message: 'This session is no longer open.' }
      const { type, durationMin, intensity } = session
      const date = compareDateKeys(session.date, todayKey()) > 0 ? todayKey() : session.date
      const input: WorkoutInput = { date, type, durationMin, intensity, kcal: null, notes: null, weightKg: null, ...actual }
      const logged = await saveWorkout(newWorkout(input, id), 'log the session')
      if (!logged.ok) return logged
      const linked = await saveSession(touch({ ...session, status: 'completed', completedWorkoutId: logged.entry.id }), 'update the session')
      if (linked.ok) return logged
      await get().deleteWorkout(logged.entry.id)
      return linked
    },

    async dismissScheduled(id) {
      const session = get().scheduled.find((s) => s.id === id)
      return session ? saveSession(touch({ ...session, status: 'dismissed' }), 'skip the session') : { ok: true }
    },

    restoreScheduled: (session) => saveSession(touch(session), 'restore the session'),
    async refresh() {
      if (lastLoad && get().window) await get().load(lastLoad.today, lastLoad.weekStartsOn, { force: true })
    },
    reset() {
      lastLoad = null
      loadToken += 1
      workoutJournal.clear()
      scheduledJournal.clear()
      set(initial)
    },
  }
})

registerUserStoreReset(() => useActivityStore.getState().reset())
