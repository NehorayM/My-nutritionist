import { describe, expect, it } from 'vitest'
import { makeOutbox, testId } from '@/schemas/__fixtures__/records'
import { createAckLog } from './ackLog'
import { backoffDelayMs, DEFAULT_BACKOFF } from './backoff'
import { coalesceMutation, nextQueueTimestamp } from './coalesce'
import { createListenerSet } from './listeners'

describe('backoffDelayMs', () => {
  it('doubles from 2 s and caps at 5 min', () => {
    expect([1, 2, 3, 4].map((attempt) => backoffDelayMs(attempt))).toEqual([2_000, 4_000, 8_000, 16_000])
    expect(backoffDelayMs(8)).toBe(256_000)
    expect(backoffDelayMs(9)).toBe(DEFAULT_BACKOFF.maxMs)
    expect(backoffDelayMs(10_000)).toBe(300_000)
  })

  it('treats attempts below 1 and fractions as the first retry', () => {
    expect(backoffDelayMs(0)).toBe(2_000)
    expect(backoffDelayMs(-3)).toBe(2_000)
    expect(backoffDelayMs(2.7)).toBe(4_000)
  })
})

describe('nextQueueTimestamp', () => {
  const now = new Date('2026-10-04T08:00:00.000Z')

  it('uses the clock when it moved past the newest queued mutation', () => {
    expect(nextQueueTimestamp(now, null)).toBe('2026-10-04T08:00:00.000Z')
    expect(nextQueueTimestamp(now, '2026-10-04T07:59:59.000Z')).toBe('2026-10-04T08:00:00.000Z')
  })

  it('stays strictly after the newest queued mutation when the clock stalls or steps back', () => {
    expect(nextQueueTimestamp(now, '2026-10-04T08:00:00.000Z')).toBe('2026-10-04T08:00:00.001Z')
    expect(nextQueueTimestamp(now, '2026-10-04T09:00:00.000Z')).toBe('2026-10-04T09:00:00.001Z')
  })
})

describe('coalesceMutation', () => {
  it('keeps the queue position and retry bookkeeping of a pending mutation', () => {
    const existing = makeOutbox({ attempts: 2, nextAttemptAt: '2026-10-04T08:00:08.000Z', lastError: 'offline' })
    const next = coalesceMutation(existing, { entity: 'meal_logs', op: 'delete', recordId: existing.recordId, payload: null }, testId(5))
    expect(next).toMatchObject({ id: testId(5), createdAt: existing.createdAt, op: 'delete', payload: null, attempts: 2 })
  })
})

describe('ack log', () => {
  it('returns keys acknowledged after a mark, and null once that history was evicted', () => {
    const log = createAckLog(2)
    const start = log.mark()
    log.record('a')
    const middle = log.mark()
    log.record('b')
    expect(log.since(start)).toEqual(new Set(['a', 'b']))
    expect(log.since(middle)).toEqual(new Set(['b']))
    log.record('c')
    expect(log.since(start)).toBeNull()
    expect(log.since(middle)).toEqual(new Set(['b', 'c']))
  })
})

describe('listener set', () => {
  it('keeps notifying the other listeners when one throws', () => {
    const set = createListenerSet<number>('test')
    const received: number[] = []
    set.add(() => {
      throw new Error('listener bug')
    })
    const remove = set.add((value) => received.push(value))
    set.emit(1)
    remove()
    set.emit(2)
    expect(received).toEqual([1])
  })
})
