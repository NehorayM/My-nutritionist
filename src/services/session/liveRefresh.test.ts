import { describe, expect, it, vi } from 'vitest'
import { createDataEvents } from '@/services/dataEvents'
import { createManualTimers } from '@/services/sync/__fixtures__/manualTimers'
import { SYNC_ENTITIES, type SyncEntity } from '@/types'
import { startLiveRefresh, type VisibilitySource } from './liveRefresh'

function fakeVisibility(): VisibilitySource & { set(hidden: boolean): void } {
  let hidden = false
  const listeners = new Set<() => void>()
  return {
    isHidden: () => hidden,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next) {
      hidden = next
      for (const listener of listeners) listener()
    },
  }
}

function setup(userId: string | null = 'me') {
  const events = createDataEvents(null)
  const timers = createManualTimers()
  const visibility = fakeVisibility()
  const refresh = vi.fn<(entities: SyncEntity[]) => Promise<void>>(async () => undefined)
  const stop = startLiveRefresh({ events, currentUserId: () => userId, refresh, timers, now: timers.now, visibility, debounceMs: 250, staleAfterMs: 30_000 })
  return { events, timers, visibility, refresh, stop }
}

describe('live refresh', () => {
  it('reloads each changed table once per burst', () => {
    const { events, timers, refresh } = setup()
    events.notifyThisTab({ userId: 'me', entities: ['meal_logs'] })
    events.notifyThisTab({ userId: 'me', entities: ['meal_logs', 'weight_logs'] })
    timers.advance(249)
    expect(refresh).not.toHaveBeenCalled()
    timers.advance(1)
    expect(refresh).toHaveBeenCalledExactlyOnceWith(['meal_logs', 'weight_logs'])
  })

  it("ignores another user's changes and changes while nobody is signed in", () => {
    const other = setup()
    other.events.notifyThisTab({ userId: 'someone-else', entities: ['meal_logs'] })
    other.timers.advance(1000)
    expect(other.refresh).not.toHaveBeenCalled()
    const none = setup(null)
    none.events.notifyThisTab({ userId: 'me', entities: ['meal_logs'] })
    none.timers.advance(1000)
    expect(none.refresh).not.toHaveBeenCalled()
  })

  it('reloads everything when a tab returns after a long time in the background', () => {
    const { visibility, timers, refresh } = setup()
    visibility.set(true)
    timers.advance(10_000)
    visibility.set(false)
    timers.advance(1000)
    expect(refresh).not.toHaveBeenCalled()
    visibility.set(true)
    timers.advance(30_000)
    visibility.set(false)
    timers.advance(250)
    expect(refresh).toHaveBeenCalledExactlyOnceWith([...SYNC_ENTITIES])
  })

  it('stops completely', () => {
    const { events, timers, refresh, stop } = setup()
    events.notifyThisTab({ userId: 'me', entities: ['meal_logs'] })
    stop()
    timers.advance(1000)
    expect(refresh).not.toHaveBeenCalled()
  })
})
