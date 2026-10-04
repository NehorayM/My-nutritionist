import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { setRepositories } from '@/services/runtime'
import { useDailyTargets } from './derived'
import { useProfileStore } from './profileStore'
import { resetUserStores } from './registry'
import { latestWeightKg, useWeightStore } from './weightStore'

const userId = newId()

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(createLocalRepositories(userId))
  resetUserStores()
})

afterEach(() => setRepositories(null))

describe('profile store', () => {
  it('starts with an in-memory default that is not persisted', async () => {
    await useProfileStore.getState().load()
    const state = useProfileStore.getState()
    expect(state.status).toBe('ready')
    expect(state.profile?.userId).toBe(userId)
    expect(state.persisted).toBe(false)
  })

  it('persists a valid profile and reloads it', async () => {
    await useProfileStore.getState().load()
    const profile = useProfileStore.getState().profile!
    const result = await useProfileStore.getState().save({ ...profile, displayName: 'Noa', heightCm: 168 })
    expect(result).toEqual({ ok: true })
    resetUserStores()
    await useProfileStore.getState().load()
    expect(useProfileStore.getState()).toMatchObject({ persisted: true, profile: { displayName: 'Noa', heightCm: 168 } })
  })

  it('rejects out-of-range values without changing the stored profile', async () => {
    await useProfileStore.getState().load()
    const profile = useProfileStore.getState().profile!
    const result = await useProfileStore.getState().save({ ...profile, heightCm: 20 })
    expect(result.ok).toBe(false)
    expect(useProfileStore.getState().profile?.heightCm).toBeNull()
  })

  it('reports a load error when repositories are unavailable', async () => {
    setRepositories(null)
    await useProfileStore.getState().load()
    expect(useProfileStore.getState().status).toBe('error')
    expect(useProfileStore.getState().error).toMatch(/couldn't load your profile/i)
  })
})

describe('weight store', () => {
  const weighIn = { inputUnit: 'kg' as const, note: null }

  it('adds, updates and removes weigh-ins with persistence', async () => {
    const store = useWeightStore.getState()
    expect(await store.add({ ...weighIn, weightKg: 70.456, date: '2026-10-01', measuredAt: '2026-10-01T06:30:00.000Z' })).toEqual({ ok: true })
    const [entry] = useWeightStore.getState().entries
    expect(entry?.weightKg).toBe(70.46)

    await useWeightStore.getState().update({ ...entry!, weightKg: 70.1 })
    resetUserStores()
    await useWeightStore.getState().load()
    expect(useWeightStore.getState().entries.map((e) => e.weightKg)).toEqual([70.1])

    await useWeightStore.getState().remove(entry!.id)
    await useWeightStore.getState().load()
    expect(useWeightStore.getState().entries).toEqual([])

    await useWeightStore.getState().restore(entry!)
    expect(useWeightStore.getState().entries).toHaveLength(1)
  })

  it('rejects implausible weights', async () => {
    const result = await useWeightStore.getState().add({ ...weighIn, weightKg: 5, date: '2026-10-01', measuredAt: '2026-10-01T06:30:00.000Z' })
    expect(result.ok).toBe(false)
    expect(useWeightStore.getState().entries).toEqual([])
  })

  it('finds the latest daily weight using the morning rule', async () => {
    const store = useWeightStore.getState()
    await store.add({ ...weighIn, weightKg: 71, date: '2026-10-02', measuredAt: '2026-10-02T05:00:00.000Z' })
    await store.add({ ...weighIn, weightKg: 72, date: '2026-10-02', measuredAt: '2026-10-02T19:00:00.000Z' })
    await store.add({ ...weighIn, weightKg: 69, date: '2026-10-05', measuredAt: '2026-10-05T05:00:00.000Z' })
    const entries = useWeightStore.getState().entries
    expect(latestWeightKg(entries, '2026-10-03')).toBe(71)
    expect(latestWeightKg(entries, '2026-10-05')).toBe(69)
    expect(latestWeightKg([], '2026-10-05')).toBeNull()
  })
})

describe('useDailyTargets', () => {
  it('recomputes targets when the profile or weigh-ins change', async () => {
    await useProfileStore.getState().load()
    const { result, rerender } = renderHook(() => useDailyTargets('2026-10-03'))
    expect(result.current.mode).toBe('general')

    const profile = useProfileStore.getState().profile!
    await useProfileStore.getState().save({ ...profile, birthDate: '1990-05-01', heightCm: 175, sex: 'male' })
    await useWeightStore.getState().add({ inputUnit: 'kg', note: null, weightKg: 80, date: '2026-10-03', measuredAt: '2026-10-03T06:00:00.000Z' })
    rerender()
    expect(result.current.mode).toBe('personalized')
    expect(result.current.estimate.bmrKcal).toBeGreaterThan(1500)
  })
})
