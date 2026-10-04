/**
 * Small LRU cache with a time-to-live. Map iteration order is insertion order, so re-inserting on read
 * moves an entry to the "most recently used" end; the first key is the least recently used.
 */
export interface LruCache<V> {
  get(key: string): V | undefined
  set(key: string, value: V): void
  delete(key: string): void
  clear(): void
  readonly size: number
}

export interface LruCacheOptions {
  maxEntries?: number
  ttlMs?: number
  now?: () => number
}

export const DEFAULT_CACHE_ENTRIES = 50
export const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000

export function createLruCache<V>(options: LruCacheOptions = {}): LruCache<V> {
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_CACHE_ENTRIES)
  const ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_CACHE_TTL_MS)
  const now = options.now ?? Date.now
  const entries = new Map<string, { value: V; expiresAt: number }>()

  return {
    get(key) {
      const entry = entries.get(key)
      if (entry === undefined) return undefined
      entries.delete(key)
      if (entry.expiresAt <= now()) return undefined
      entries.set(key, entry)
      return entry.value
    },
    set(key, value) {
      entries.delete(key)
      entries.set(key, { value, expiresAt: now() + ttlMs })
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        entries.delete(oldest.value)
      }
    },
    delete(key) {
      entries.delete(key)
    },
    clear() {
      entries.clear()
    },
    get size() {
      return entries.size
    },
  }
}
