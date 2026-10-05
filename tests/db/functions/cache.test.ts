import { describe, expect, it } from 'vitest'
import { createLruCache } from '../../../supabase/functions/food-search/cache.ts'

function clock(start = 1_000) {
  let now = start
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

describe('createLruCache', () => {
  it('returns stored values until their TTL elapses', () => {
    const time = clock()
    const cache = createLruCache<string>(10, time.now)
    cache.set('a', 'apple', 100)
    time.advance(99)
    expect(cache.get('a')).toBe('apple')
    time.advance(1)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('evicts the least recently used entry when full', () => {
    const cache = createLruCache<number>(2, clock().now)
    cache.set('a', 1, 1_000)
    cache.set('b', 2, 1_000)
    expect(cache.get('a')).toBe(1)
    cache.set('c', 3, 1_000)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('replaces an existing key with the new value and TTL', () => {
    const time = clock()
    const cache = createLruCache<string>(2, time.now)
    cache.set('a', 'old', 10)
    cache.set('a', 'new', 1_000)
    time.advance(500)
    expect(cache.get('a')).toBe('new')
    expect(cache.size).toBe(1)
  })

  it('does not store entries with a non-positive TTL', () => {
    const cache = createLruCache<string>(2, clock().now)
    cache.set('a', 'value', 0)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('rejects an invalid capacity', () => {
    expect(() => createLruCache(0, clock().now)).toThrow(RangeError)
    expect(() => createLruCache(1.5, clock().now)).toThrow(RangeError)
  })
})
