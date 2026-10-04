import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeWeeklyProgress, planCatchUp } from '@/domain/activity'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { getRepositories, setRepositories } from '@/services/runtime'
import { useActivityStore, type WorkoutInput } from './activityStore'
import { resetUserStores } from './registry'

// Wednesday 2026-10-07; Monday-start week 2026-10-05 … 2026-10-11.
const TODAY = '2026-10-07'
const run: WorkoutInput = { date: '2026-10-06', type: 'run', durationMin: 30, intensity: 'moderate', kcal: null, notes: '  ', weightKg: 70 }
const plan = { strengthSessionsPerWeek: 1, cardioSessionsPerWeek: 2 }

const store = () => useActivityStore.getState()
const storedWorkouts = () => getRepositories().workouts.listRange({ from: '2026-09-28', to: '2026-10-11' })
const storedSessions = () => getRepositories().scheduledWorkouts.listRange({ from: '2026-10-05', to: '2026-10-11' })
const progress = () => computeWeeklyProgress({ workouts: store().workouts, plan, today: TODAY, weekStartsOn: 1 })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 9, 0))
  await deleteDatabase()
  setRepositories(createLocalRepositories(newId()))
  resetUserStores()
  await store().load(TODAY, 1)
})

afterEach(() => {
  setRepositories(null)
  vi.useRealTimers()
})

describe('activity store: workouts', () => {
  it('logs a workout with an informational MET estimate when no kcal is entered', async () => {
    const result = await store().logWorkout(run)
    expect(result.ok).toBe(true)
    // 9.3 MET × 70 kg × 0.5 h = 325.5 → nearest 5 kcal.
    expect(store().workouts).toMatchObject([{ type: 'run', estimatedKcal: 325, kcalSource: 'estimate', notes: null }])
    expect(await storedWorkouts()).toHaveLength(1)
  })

  it('keeps kcal the user typed, and stores no estimate when the weight is unknown', async () => {
    await store().logWorkout({ ...run, kcal: 410.4, notes: 'Hill repeats' })
    await store().logWorkout({ ...run, date: TODAY, weightKg: null })
    expect(store().workouts.map((w) => [w.estimatedKcal, w.kcalSource, w.notes])).toEqual([
      [410, 'user', 'Hill repeats'],
      [null, null, null],
    ])
  })

  it('rejects future dates and zero-minute workouts without saving', async () => {
    expect(await store().logWorkout({ ...run, date: '2026-10-08' })).toMatchObject({ ok: false })
    expect(await store().logWorkout({ ...run, durationMin: 0 })).toMatchObject({ ok: false, message: expect.stringMatching(/1–600 minutes/) })
    expect(store().workouts).toEqual([])
    expect(await storedWorkouts()).toEqual([])
  })

  it('re-estimates on update, then deletes and restores (undo)', async () => {
    const logged = await store().logWorkout(run)
    if (!logged.ok) throw new Error(logged.message)
    await store().updateWorkout(logged.entry.id, { ...run, durationMin: 60 })
    expect(store().workouts[0]).toMatchObject({ durationMin: 60, estimatedKcal: 650, kcalSource: 'estimate' })

    expect(await store().deleteWorkout(logged.entry.id)).toEqual({ ok: true })
    expect(store().workouts).toEqual([])
    expect(await storedWorkouts()).toEqual([])

    const removed = { ...logged.entry, durationMin: 60, estimatedKcal: 650 }
    expect((await store().restoreWorkout(removed)).ok).toBe(true)
    expect((await storedWorkouts()).map((w) => w.id)).toEqual([logged.entry.id])
  })

  it('rolls back and reports a neutral error when saving fails', async () => {
    const repos = getRepositories()
    setRepositories({ ...repos, workouts: { ...repos.workouts, save: () => Promise.reject(new Error('disk full')) } })
    const result = await store().logWorkout(run)
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/couldn't save your workout/i) })
    expect(store().workouts).toEqual([])
  })
})

describe('activity store: scheduled sessions', () => {
  function catchUp() {
    return planCatchUp({ progress: progress(), recentWorkouts: store().workouts, scheduled: store().scheduled, preferredMinutes: 40, dismissedIds: [], variant: 0 })
  }

  it('schedules catch-up suggestions, completes one, and counts it as done', async () => {
    const suggestions = catchUp().suggestions
    expect(suggestions.length).toBe(3)
    expect(await store().scheduleSessions(suggestions)).toEqual({ ok: true })
    expect(await storedSessions()).toHaveLength(3)
    expect(store().scheduled.every((s) => s.source === 'catch_up' && s.status === 'planned' && s.rationale)).toBe(true)
    expect(catchUp().status).toBe('on_track')

    const first = store().scheduled.find((s) => s.date === TODAY)!
    const done = await store().completeScheduled(first.id, { weightKg: 70, notes: 'Felt good' })
    if (!done.ok) throw new Error(done.message)
    expect(done.entry).toMatchObject({ date: TODAY, type: first.type, scheduledWorkoutId: first.id, kcalSource: 'estimate', notes: 'Felt good' })
    expect(store().scheduled.find((s) => s.id === first.id)).toMatchObject({ status: 'completed', completedWorkoutId: done.entry.id })
    expect(progress().totalCompleted).toBe(1)
  })

  it('reopens a session when its workout is deleted and re-links it on undo', async () => {
    await store().scheduleSessions(catchUp().suggestions.slice(0, 1))
    const [session] = store().scheduled
    const done = await store().completeScheduled(session!.id)
    if (!done.ok) throw new Error(done.message)

    await store().deleteWorkout(done.entry.id)
    expect(store().scheduled[0]).toMatchObject({ status: 'planned', completedWorkoutId: null })
    await store().restoreWorkout(done.entry)
    expect(store().scheduled[0]).toMatchObject({ status: 'completed', completedWorkoutId: done.entry.id })
  })

  it('logs a future session on today when completed early', async () => {
    const later = catchUp().suggestions.find((s) => s.date > TODAY)!
    await store().scheduleSessions([later])
    const done = await store().completeScheduled(store().scheduled[0]!.id)
    expect(done).toMatchObject({ ok: true, entry: { date: TODAY } })
  })

  it('skips a session and restores it', async () => {
    await store().scheduleSessions(catchUp().suggestions.slice(0, 1))
    const [session] = store().scheduled
    await store().dismissScheduled(session!.id)
    expect((await storedSessions())[0]?.status).toBe('dismissed')
    expect(await store().completeScheduled(session!.id)).toMatchObject({ ok: false })
    await store().restoreScheduled(session!)
    expect((await storedSessions())[0]?.status).toBe('planned')
  })
})

describe('activity store: loading', () => {
  it('loads the previous week too and reloads only when the week changes', async () => {
    await store().logWorkout({ ...run, date: '2026-09-29' })
    await store().logWorkout(run)
    expect(store().window).toEqual({
      weekStart: '2026-10-05',
      workouts: { from: '2026-09-28', to: '2026-10-11' },
      scheduled: { from: '2026-10-05', to: '2026-10-11' },
    })
    expect(store().workouts).toHaveLength(2)

    // Same week: no refetch, even if the repository changed behind the store's back.
    await getRepositories().workouts.remove(store().workouts[0]!.id)
    await store().load('2026-10-09', 1)
    expect(store().workouts).toHaveLength(2)
    await store().load('2026-10-09', 1, { force: true })
    expect(store().workouts).toHaveLength(1)

    // A new week (Sunday-start puts 2026-10-04 … 2026-10-10 in view) loads a new window.
    await store().load(TODAY, 0)
    expect(store().window?.weekStart).toBe('2026-10-04')
    expect(store().workouts.map((w) => w.date)).toEqual(['2026-10-06'])
  })

  it('surfaces a load error and clears on reset', async () => {
    setRepositories(null)
    await store().load('2026-10-14', 1)
    expect(store()).toMatchObject({ status: 'error', error: expect.stringMatching(/couldn't load your activity/i) })
    resetUserStores()
    expect(store()).toMatchObject({ status: 'idle', window: null, workouts: [], scheduled: [] })
  })
})
