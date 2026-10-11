import { describe, expect, it, vi } from 'vitest'
import type { SyncEntity } from '@/types'
import { changedTable, createRealtimeChanges } from './realtimeChanges'

type StatusCallback = (status: string) => void
type BroadcastCallback = (message: { payload?: unknown }) => void

function fakeClient() {
  const state: { topic?: string; options?: unknown; broadcast?: BroadcastCallback; status?: StatusCallback; removed: number } = { removed: 0 }
  const channel = {
    on: (_type: string, _filter: unknown, callback: BroadcastCallback) => {
      state.broadcast = callback
      return channel
    },
    subscribe: (callback: StatusCallback) => {
      state.status = callback
      return channel
    },
  }
  const client = {
    channel: (topic: string, options: unknown) => {
      state.topic = topic
      state.options = options
      return channel
    },
    removeChannel: async () => {
      state.removed += 1
      return 'ok'
    },
  }
  return { client: client as unknown as Parameters<typeof createRealtimeChanges>[0], state }
}

describe('realtime change notifications', () => {
  it('joins the private topic of the user and reports changed tables', () => {
    const { client, state } = fakeClient()
    const listener = { changed: vi.fn<(entities: SyncEntity[]) => void>(), resynced: vi.fn<() => void>() }
    const stop = createRealtimeChanges(client)('user-1', listener)
    expect(state.topic).toBe('user:user-1')
    expect(state.options).toEqual({ config: { private: true } })
    state.broadcast?.({ payload: { table: 'meal_logs' } })
    state.broadcast?.({ payload: { table: 'auth.users' } })
    expect(listener.changed.mock.calls).toEqual([[['meal_logs']]])
    stop()
    expect(state.removed).toBe(1)
  })

  it('asks for a full reload after reconnecting (changes may have been missed)', () => {
    const { client, state } = fakeClient()
    const listener = { changed: vi.fn<(entities: SyncEntity[]) => void>(), resynced: vi.fn<() => void>() }
    createRealtimeChanges(client)('user-1', listener)
    state.status?.('SUBSCRIBED')
    expect(listener.resynced).not.toHaveBeenCalled()
    state.status?.('CHANNEL_ERROR')
    state.status?.('SUBSCRIBED')
    expect(listener.resynced).toHaveBeenCalledTimes(1)
  })

  it('reads the table name defensively', () => {
    expect(changedTable({ table: 'weight_logs' })).toBe('weight_logs')
    expect(changedTable({ table: 'reminder_dispatches' })).toBe('reminder_schedules')
    expect(changedTable({ table: 5 })).toBeNull()
    expect(changedTable('meal_logs')).toBeNull()
  })
})
