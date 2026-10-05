/**
 * Memoizes a pure function of one object, keyed by identity. Food items are immutable values throughout the app
 * (stores replace them, never mutate them), so a result stays valid for as long as the object lives; entries are
 * dropped with the object (WeakMap). Planning evaluates the same foods hundreds of times per plan.
 */
export function memoize<K extends object, T>(compute: (key: K) => T): (key: K) => T {
  const cache = new WeakMap<K, { value: T }>()
  return (key) => {
    const hit = cache.get(key)
    if (hit) return hit.value
    const value = compute(key)
    cache.set(key, { value })
    return value
  }
}
