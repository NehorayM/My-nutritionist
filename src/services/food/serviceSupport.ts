import { runWithDeadline } from './deadline'
import type { FoodProviderError, FoodProviderId } from './providers/types'
import { normalizeSearchText } from './search/text'
import type { CachedValue, FoodSearchCache, ProviderStatus } from './searchTypes'

/** Settled provider call: never rejects, so one failing provider cannot hide the others' results. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: FoodProviderError }

export function settle<T>(
  providerId: FoodProviderId,
  task: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Outcome<T>> {
  return runWithDeadline(providerId, task, { signal, timeoutMs }).then(
    (value): Outcome<T> => ({ ok: true, value }),
    (error: FoodProviderError): Outcome<T> => ({ ok: false, error }),
  )
}

export function statusOf(outcome: Outcome<unknown> | null): ProviderStatus {
  if (outcome === null) return 'skipped'
  return outcome.ok ? 'ok' : outcome.error.kind
}

/** Cache key: provider + operation + normalized query + paging, e.g. "usda|search|generic|cheddar cheese|1|15". */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.map((part) => (typeof part === 'string' ? normalizeSearchText(part) : String(part))).join('|')
}

/**
 * Read-through cache for successful remote results only (errors are never cached, so a retry really retries).
 * `read` extracts the typed value from a cached entry; `wrap` stores a fresh one.
 */
export async function readThrough<T>(
  cache: FoodSearchCache | null,
  key: string,
  read: (entry: CachedValue) => T | undefined,
  wrap: (value: T) => CachedValue,
  load: () => Promise<T>,
): Promise<T> {
  const entry = cache?.get(key)
  const hit = entry === undefined ? undefined : read(entry)
  if (hit !== undefined) return hit
  const value = await load()
  cache?.set(key, wrap(value))
  return value
}

export function clampPage(page: number | undefined): number {
  if (page === undefined || !Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}
