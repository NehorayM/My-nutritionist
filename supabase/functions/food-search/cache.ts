/**
 * Small in-memory LRU cache with per-entry TTL (one instance per Edge Function isolate).
 * It only saves upstream calls; correctness never depends on it (an isolate can be recycled at any time).
 */
export interface TtlCache<V> {
  get(key: string): V | undefined
  set(key: string, value: V, ttlMs: number): void
  readonly size: number
}

interface Entry<V> {
  value: V
  expiresAt: number
}

export function createLruCache<V>(maxEntries: number, now: () => number): TtlCache<V> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError('maxEntries must be a positive integer')
  // Map iteration order is insertion order: the first key is always the least recently used.
  const entries = new Map<string, Entry<V>>()

  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      if (entry.expiresAt <= now()) return undefined
      entries.set(key, entry)
      return entry.value
    },
    set(key, value, ttlMs) {
      entries.delete(key)
      if (ttlMs <= 0) return
      entries.set(key, { value, expiresAt: now() + ttlMs })
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        entries.delete(oldest.value)
      }
    },
    get size() {
      return entries.size
    },
  }
}
