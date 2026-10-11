import { describe, expect, it, vi } from 'vitest'
import { createChannelPair } from './__fixtures__/channelPair'
import { createDataEvents, parseDataChange, type DataChange } from './dataEvents'

describe('data change events', () => {
  it('delivers this tab’s writes to other tabs only', async () => {
    const [left, right] = createChannelPair()
    const tabA = createDataEvents(left)
    const tabB = createDataEvents(right)
    const heardA = vi.fn<(change: DataChange) => void>()
    const heardB = vi.fn<(change: DataChange) => void>()
    tabA.subscribe(heardA)
    tabB.subscribe(heardB)
    tabA.notifyOtherTabs({ userId: 'u1', entities: ['meal_logs'] })
    await vi.waitFor(() => expect(heardB).toHaveBeenCalledWith({ userId: 'u1', entities: ['meal_logs'] }))
    expect(heardA).not.toHaveBeenCalled()
  })

  it('delivers server-side changes to this tab', () => {
    const events = createDataEvents(null)
    const heard = vi.fn<(change: DataChange) => void>()
    events.subscribe(heard)
    events.notifyThisTab({ userId: 'u1', entities: ['weight_logs'] })
    events.notifyThisTab({ userId: 'u1', entities: [] })
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('ignores malformed or unknown messages from the channel', () => {
    expect(parseDataChange(null)).toBeNull()
    expect(parseDataChange({ userId: 1, entities: ['meal_logs'] })).toBeNull()
    expect(parseDataChange({ userId: 'u', entities: ['secrets'] })).toBeNull()
    expect(parseDataChange({ userId: 'u', entities: ['secrets', 'meal_logs'] })).toEqual({ userId: 'u', entities: ['meal_logs'] })
  })

  it('stops listening after dispose and survives a failing listener', async () => {
    const [left, right] = createChannelPair()
    const tabA = createDataEvents(left)
    const tabB = createDataEvents(right)
    const after = vi.fn<(change: DataChange) => void>()
    tabB.subscribe(() => {
      throw new Error('boom')
    })
    tabB.subscribe(after)
    tabA.notifyOtherTabs({ userId: 'u', entities: ['favorites'] })
    await vi.waitFor(() => expect(after).toHaveBeenCalledTimes(1))
    tabB.dispose()
    tabA.notifyOtherTabs({ userId: 'u', entities: ['favorites'] })
    await Promise.resolve()
    expect(after).toHaveBeenCalledTimes(1)
  })
})
