import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import { observeWrites } from '@/repositories/observed'
import { makeMeal, makeWeight } from '@/schemas/__fixtures__/records'
import { createChannelPair } from '@/services/__fixtures__/channelPair'
import { createDataEvents, type DataChange } from '@/services/dataEvents'
import { setRepositories } from '@/services/runtime'
import type { RemoteChangeListener } from '@/services/sync/realtimeChanges'
import { useMealsStore } from '@/stores/mealsStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useWeightStore } from '@/stores/weightStore'
import { fakeAuth, fakeConnectivity, fakeDeps } from './__fixtures__/sessionFakes'
import { createSessionController } from './controller'

/**
 * Screens follow data changed elsewhere: another tab of this device (BroadcastChannel) or another device
 * (Realtime notification). "Elsewhere" writes go straight to storage here, then announce themselves.
 */
const DAY = '2026-10-03'

beforeEach(async () => {
  await deleteDatabase()
  setRepositories(null)
  useSessionStore.setState({ phase: 'booting', mode: null, userId: null, email: null, passwordRecovery: false })
})

afterEach(() => setRepositories(null))

describe('live sync between tabs (guest mode)', () => {
  it('shows a meal logged in another tab without a reload', async () => {
    const [thisTab, otherTab] = createChannelPair()
    const { deps, guestId } = fakeDeps({ events: createDataEvents(thisTab) })
    await createSessionController(deps).start()
    await useMealsStore.getState().load(DAY)
    expect(useMealsStore.getState().days[DAY]?.entries).toEqual([])

    const other = createDataEvents(otherTab)
    const otherRepos = observeWrites(createLocalRepositories(guestId), (entity) => other.notifyOtherTabs({ userId: guestId, entities: [entity] }))
    await otherRepos.meals.save(makeMeal({ userId: guestId, date: DAY }))

    await vi.waitFor(() => expect(useMealsStore.getState().days[DAY]?.entries).toHaveLength(1), { timeout: 3000 })
  })

  it("tells other tabs about this tab's writes", async () => {
    const [thisTab, otherTab] = createChannelPair()
    const { deps, guestId } = fakeDeps({ events: createDataEvents(thisTab) })
    await createSessionController(deps).start()
    const heard = vi.fn<(change: DataChange) => void>()
    createDataEvents(otherTab).subscribe(heard)
    await useWeightStore.getState().add({ weightKg: 70, inputUnit: 'kg', date: DAY, measuredAt: '2026-10-03T07:00:00.000Z', note: null })
    await vi.waitFor(() => expect(heard).toHaveBeenCalledWith({ userId: guestId, entities: ['weight_logs'] }))
  })
})

describe('live sync between devices (signed in)', () => {
  it('reloads data another device changed when the server announces it', async () => {
    const account = { userId: newId(), email: 'noa@example.com' }
    let listener: RemoteChangeListener | null = null
    const unsubscribe = vi.fn<() => void>()
    const { deps } = fakeDeps({
      auth: fakeAuth(account).service,
      connectivity: fakeConnectivity(),
      remoteChanges: (userId, next) => {
        expect(userId).toBe(account.userId)
        listener = next
        return unsubscribe
      },
    })
    const controller = createSessionController(deps)
    await controller.start()
    await vi.waitFor(() => expect(useSessionStore.getState().mode).toBe('cloud'))
    await useWeightStore.getState().load()
    expect(useWeightStore.getState().entries).toEqual([])

    // Another device saved a weigh-in; this device's repositories now return it.
    await createLocalRepositories(account.userId).weights.save(makeWeight({ userId: account.userId }))
    expect(listener).not.toBeNull()
    listener!.changed(['weight_logs'])
    await vi.waitFor(() => expect(useWeightStore.getState().entries).toHaveLength(1), { timeout: 3000 })

    await controller.signOut()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
