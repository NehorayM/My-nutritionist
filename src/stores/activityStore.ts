import { create } from 'zustand'
import { compareWorkouts, estimateWorkoutKcal, getWeekWindow, type CatchUpSuggestion } from '@/domain/activity'
import { addDays, compareDateKeys, todayKey } from '@/domain/dates'
import { newId } from '@/lib/id'
import type { DateRange } from '@/repositories/types'
import { LIMITS, scheduledWorkoutSchema, TEXT_LIMITS, workoutEntrySchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { ScheduledWorkout, WorkoutEntry } from '@/types'
import { userMessageFor } from './errors'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset } from './registry'

/** What the user logs. `kcal` is what they typed; null → informational estimate from `weightKg` (if known). */
export type WorkoutInput = Pick<WorkoutEntry, 'date' | 'type' | 'durationMin' | 'intensity' | 'notes'> & {
  kcal: number | null
  weightKg: number | null
}

type Saved<T> = { ok: true; entry: T } | { ok: false; message: string }
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
  reset: () => void
}

type Dated = { id: string; date: string; createdAt: string; updatedAt: string }

/** One loaded list (workouts or scheduled sessions) and how its records are checked, saved and ordered. */
interface ListSpec<T extends Dated> {
  list: () => T[]
  apply: (list: T[]) => void
  save: (record: T) => Promise<T>
  valid: (record: T) => boolean
  range: () => DateRange | undefined
  order: (a: T, b: T) => number
  invalid: string
}

const initial = { window: null, workouts: [], scheduled: [], status: 'idle' as LoadStatus, error: null }
let loadToken = 0

const byDate = (a: Dated, b: Dated) => compareDateKeys(a.date, b.date) || a.createdAt.localeCompare(b.createdAt)
const touch = <T extends Dated>(record: T): T => ({ ...record, updatedAt: new Date().toISOString() })
const inRange = (date: string, range?: DateRange) => !range || (date >= range.from && date <= range.to)

/** Replaces the record with `id` by `item` (dropping it when `item` is null or outside the loaded range). */
function replace<T extends Dated>(spec: ListSpec<T>, id: string, item: T | null): void {
  const rest = spec.list().filter((existing) => existing.id !== id)
  spec.apply((item && inRange(item.date, spec.range()) ? [...rest, item] : rest).sort(spec.order))
}

/** Optimistic upsert with rollback of just this record on failure. */
async function persist<T extends Dated>(spec: ListSpec<T>, record: T, action: string): Promise<Saved<T>> {
  if (!spec.valid(record)) return { ok: false, message: spec.invalid }
  const before = spec.list().find((existing) => existing.id === record.id) ?? null
  replace(spec, record.id, record)
  try {
    const saved = await spec.save(record)
    replace(spec, saved.id, saved)
    return { ok: true, entry: saved }
  } catch (error) {
    replace(spec, record.id, before)
    return { ok: false, message: userMessageFor(error, action) }
  }
}

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
  }
  const scheduled: ListSpec<ScheduledWorkout> = {
    list: () => get().scheduled,
    apply: (list) => set({ scheduled: list }),
    range: () => get().window?.scheduled,
    save: (record) => getRepositories().scheduledWorkouts.save(record),
    valid: (record) => scheduledWorkoutSchema.safeParse(record).success,
    order: byDate,
    invalid: "Couldn't save the session. Please try again.",
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
      const week = getWeekWindow(today, weekStartsOn)
      const current = get()
      const sameWeek = current.window?.weekStart === week.start
      if (!options.force && sameWeek && current.status !== 'error') return
      const range = { from: week.start, to: week.end }
      const window = { weekStart: week.start, workouts: { ...range, from: addDays(week.start, -7) }, scheduled: range }
      const token = ++loadToken
      set({ window, status: 'loading', error: null, ...(sameWeek ? {} : { workouts: [], scheduled: [] }) })
      try {
        const { workouts: logs, scheduledWorkouts: plans } = getRepositories()
        const [logged, planned] = await Promise.all([logs.listRange(window.workouts), plans.listRange(window.scheduled)])
        if (token === loadToken) set({ workouts: logged.sort(compareWorkouts), scheduled: planned.sort(byDate), status: 'ready' })
      } catch (error) {
        if (token === loadToken) set({ status: 'error', error: userMessageFor(error, 'load your activity') })
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
      replace(workouts, id, null)
      try {
        await getRepositories().workouts.remove(id)
      } catch (error) {
        replace(workouts, id, entry)
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
    reset() {
      loadToken += 1
      set(initial)
    },
  }
})

registerUserStoreReset(() => useActivityStore.getState().reset())
