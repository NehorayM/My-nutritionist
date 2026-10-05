import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultProfile } from '@/domain/profile'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import type { SyncStatus } from '@/services/sync'
import { heightCmFrom, heightInputFrom, validHeight, validWeight, weightInputFrom, weightKgFrom, weightRangeText } from './bodyInputs'
import { connectionSummary, pendingText } from './connectionSummary'
import { collectExport } from './exportData'

const sync = (overrides: Partial<SyncStatus> = {}): SyncStatus => ({
  state: 'idle',
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  lastError: null,
  ...overrides,
})

describe('connectionSummary', () => {
  it('never claims a connection in guest mode', () => {
    for (const connection of ['connected', 'unconfigured', 'offline'] as const) {
      expect(connectionSummary({ mode: 'guest', connection, sync: null, authAvailable: true }).title).toBe('Running in Offline/Local Mode')
    }
    expect(connectionSummary({ mode: null, connection: 'unconfigured', sync: null, authAvailable: false }).description).toMatch(/not set up/)
  })

  it('shows "Connected to Supabase" only for a verified connection while signed in', () => {
    expect(connectionSummary({ mode: 'cloud', connection: 'connected', sync: sync(), authAvailable: true })).toMatchObject({
      title: 'Connected to Supabase',
      tone: 'success',
    })
    expect(connectionSummary({ mode: 'cloud', connection: 'checking', sync: sync(), authAvailable: true }).title).toBe('Checking connection…')
    expect(connectionSummary({ mode: 'cloud', connection: 'offline', sync: sync(), authAvailable: true }).title).toMatch(/^Offline/)
  })

  it('flags failed changes and reports pending synchronization', () => {
    const summary = connectionSummary({ mode: 'cloud', connection: 'connected', sync: sync({ failed: 2 }), authAvailable: true })
    expect(summary).toMatchObject({ tone: 'warning', description: expect.stringContaining('2 changes need attention') })
    expect(pendingText(sync({ pending: 3 }))).toBe('Pending synchronization: 3')
    expect(pendingText(sync())).toBeNull()
    expect(pendingText(null)).toBeNull()
  })
})

describe('body inputs', () => {
  it('round-trips metric and imperial heights', () => {
    expect(heightInputFrom(null)).toEqual({ cm: null, feet: null, inches: null })
    expect(heightInputFrom(180)).toEqual({ cm: 180, feet: 5, inches: 11 })
    expect(heightCmFrom({ cm: 172, feet: null, inches: null }, 'metric')).toBe(172)
    expect(heightCmFrom({ cm: null, feet: 5, inches: 11 }, 'imperial')).toBe(180.3)
    expect(heightCmFrom({ cm: null, feet: 6, inches: null }, 'imperial')).toBe(182.9)
    expect(heightCmFrom({ cm: null, feet: null, inches: null }, 'imperial')).toBeNull()
  })

  it('converts weights and validates ranges', () => {
    expect(weightInputFrom(70, 'imperial')).toBe(154.3)
    expect(weightInputFrom(null, 'metric')).toBeNull()
    expect(weightKgFrom(154.3, 'imperial')).toBe(69.99)
    expect(weightKgFrom(null, 'imperial')).toBeNull()
    expect(validWeight(19)).toBe(false)
    expect(validWeight(null)).toBe(true)
    expect(validHeight(300)).toBe(false)
    expect(weightRangeText('imperial')).toBe('44–882 lb')
    expect(weightRangeText('metric')).toBe('20–400 kg')
  })
})

describe('collectExport', () => {
  beforeEach(() => deleteDatabase())

  it('gathers every record of the current user', async () => {
    const userId = newId()
    const repos = createLocalRepositories(userId)
    const now = '2026-10-05T08:00:00.000Z'
    await repos.profile.save(createDefaultProfile(userId, now))
    await repos.weights.save({ id: newId(), userId, date: '2026-10-05', measuredAt: now, weightKg: 70, inputUnit: 'kg', note: null, createdAt: now, updatedAt: now })
    const data = await collectExport(repos, new Date(now))
    expect(data).toMatchObject({ app: 'My-nutritionist', version: 1, userId, exportedAt: now })
    expect(data.profile?.userId).toBe(userId)
    expect(data.weights).toHaveLength(1)
    expect(data.meals).toEqual([])
  })
})
