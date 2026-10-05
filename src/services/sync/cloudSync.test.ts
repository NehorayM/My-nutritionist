import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { FakeSupabase } from '@/repositories/supabase/__fixtures__/fakeSupabase'
import { makeMeal, testId, USER_A } from '@/schemas/__fixtures__/records'
import { createManualTimers } from './__fixtures__/manualTimers'
import { createCloudSync, type CloudSync } from './cloudSync'
import { createConnectivityMonitor, type ConnectivityMonitor } from './connectivity'

const TARGET = { url: 'https://abc.supabase.co', key: 'sb_publishable_test' }
const DAY = '2026-10-03'

let cloud: CloudSync | null = null
let monitor: ConnectivityMonitor | null = null

function setup(health: 'ok' | 'down') {
  const server = new FakeSupabase()
  const timers = createManualTimers()
  const fetchImpl = vi.fn<typeof fetch>(() =>
    health === 'ok' ? Promise.resolve(new Response('{}', { status: 200 })) : Promise.reject(new TypeError('Failed to fetch')),
  )
  monitor = createConnectivityMonitor({ config: TARGET, fetchImpl, timers, events: null, isBrowserOnline: () => true })
  cloud = createCloudSync({ client: server, userId: USER_A, connectivity: monitor, clock: timers.clock, timers })
  return { server, timers, monitor, cloud }
}

beforeEach(async () => {
  await deleteDatabase()
})

afterEach(async () => {
  cloud?.dispose()
  monitor?.dispose()
  cloud = null
  monitor = null
  await deleteDatabase()
})

describe('createCloudSync', () => {
  it('saves locally at once and syncs once the connection is verified', async () => {
    const h = setup('ok')
    const meal = makeMeal({ id: testId(1) })
    await h.cloud.repositories.meals.save(meal)
    expect(h.server.calls).toEqual([])
    expect(await h.monitor.verify()).toBe('connected')
    h.timers.advance(0)
    await vi.waitFor(() => expect(h.cloud.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0 }))
    expect(await h.cloud.remote.meals.listByDate(DAY)).toEqual([meal])
    expect(await h.cloud.repositories.meals.listByDate(DAY)).toEqual([meal])
  })

  it('keeps working from this device while the server is unreachable', async () => {
    const h = setup('down')
    const meal = makeMeal({ id: testId(2) })
    await h.cloud.repositories.meals.save(meal)
    expect(await h.cloud.repositories.meals.listByDate(DAY)).toEqual([meal])
    expect(h.monitor.getState()).toBe('offline')
    expect(await h.cloud.engine.flushNow()).toMatchObject({ state: 'offline', pending: 1 })
    expect(h.server.calls).toEqual([])
    expect(h.cloud.outbox.userId).toBe(USER_A)
  })
})
