import { describe, expect, it } from 'vitest'
import { readNumber } from '../../../supabase/functions/_shared/usda/guards.ts'
import { createLruCache } from './cache'
import { runWithDeadline } from './deadline'
import { parseRetryAfter, toProviderError } from './providerErrors'
import { FoodProviderError } from './providers/types'
import { createTokenBucket } from './rateLimiter'

describe('LRU + TTL cache', () => {
  it('evicts the least recently used entry beyond capacity', () => {
    const cache = createLruCache<number>({ maxEntries: 2, ttlMs: 1000, now: () => 0 })
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1) // "a" becomes most recently used
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.size).toBe(2)
  })

  it('expires entries after the TTL and supports delete/clear', () => {
    let now = 0
    const cache = createLruCache<string>({ ttlMs: 600_000, now: () => now })
    cache.set('q', 'value')
    now = 599_999
    expect(cache.get('q')).toBe('value')
    now = 600_000
    expect(cache.get('q')).toBeUndefined()
    expect(cache.size).toBe(0)
    cache.set('x', '1')
    cache.set('y', '2')
    cache.delete('x')
    expect(cache.get('x')).toBeUndefined()
    cache.clear()
    expect(cache.size).toBe(0)
  })
})

describe('token bucket', () => {
  it('refills one token per interval and honours an explicit block', () => {
    let now = 0
    const bucket = createTokenBucket({ capacity: 2, refillIntervalMs: 1000, now: () => now })
    expect(bucket.tryAcquire().ok).toBe(true)
    expect(bucket.tryAcquire().ok).toBe(true)
    expect(bucket.tryAcquire()).toEqual({ ok: false, retryAfterMs: 1000 })
    now = 500
    expect(bucket.tryAcquire()).toEqual({ ok: false, retryAfterMs: 500 })
    now = 1000
    expect(bucket.tryAcquire().ok).toBe(true)
    bucket.blockFor(30_000)
    now = 20_000
    expect(bucket.tryAcquire()).toEqual({ ok: false, retryAfterMs: 11_000 })
    now = 31_000
    expect(bucket.tryAcquire().ok).toBe(true)
  })
})

describe('provider error helpers', () => {
  it('parses Retry-After seconds and HTTP dates', () => {
    const now = Date.parse('2026-10-04T10:00:00Z')
    expect(parseRetryAfter('120', now)).toBe(120_000)
    expect(parseRetryAfter('Sun, 04 Oct 2026 10:01:00 GMT', now)).toBe(60_000)
    expect(parseRetryAfter('Sun, 04 Oct 2026 09:00:00 GMT', now)).toBe(0)
    expect(parseRetryAfter('soon', now)).toBeNull()
    expect(parseRetryAfter(null, now)).toBeNull()
  })

  it('normalizes thrown values into FoodProviderErrors', () => {
    const own = new FoodProviderError('off', 'http', 'x')
    expect(toProviderError('off', own, undefined)).toBe(own)
    expect(toProviderError('off', new DOMException('t', 'TimeoutError'), undefined).kind).toBe('timeout')
    expect(toProviderError('off', new DOMException('a', 'AbortError'), undefined).kind).toBe('aborted')
    expect(toProviderError('off', 'boom', undefined, 'network')).toMatchObject({ kind: 'network', message: 'Food data request failed' })
  })
})

describe('runWithDeadline', () => {
  it('passes results through and never starts a call for an already-aborted caller', async () => {
    expect(await runWithDeadline('local', async () => 42, { timeoutMs: 100 })).toBe(42)
    const controller = new AbortController()
    controller.abort()
    let started = false
    const error = await runWithDeadline(
      'local',
      async () => {
        started = true
        return 1
      },
      { signal: controller.signal, timeoutMs: 100 },
    ).catch((reason: unknown) => reason)
    expect(error).toMatchObject({ kind: 'aborted', providerId: 'local' })
    expect(started).toBe(false)
  })
})

describe('USDA JSON readers', () => {
  it('accepts numeric strings but never coerces junk to a number', () => {
    expect(readNumber({ v: ' 12.5 ' }, 'v')).toBe(12.5)
    expect(readNumber({ v: '1e3' }, 'v')).toBe(1000)
    expect(readNumber({ v: '' }, 'v')).toBeNull()
    expect(readNumber({ v: '12g' }, 'v')).toBeNull()
    expect(readNumber({ v: Number.NaN }, 'v')).toBeNull()
    expect(readNumber({}, 'v')).toBeNull()
  })
})
