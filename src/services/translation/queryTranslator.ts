import type { MachineTranslator } from './machine'
import { translateWithDictionary, type QueryTranslation } from './translate'

/**
 * Hebrew → English for food searches: the dictionary answers instantly (and offline); when it leaves words
 * unknown and the device is online, machine translation of the whole text is tried. Machine results are cached
 * for the session.
 */
export interface QueryTranslator {
  /** Instant dictionary translation; null when the text has no Hebrew. */
  translateNow(text: string): QueryTranslation | null
  /** The best translation available: the dictionary's, completed by machine translation when needed. */
  translate(text: string, signal?: AbortSignal): Promise<QueryTranslation | null>
}

export interface QueryTranslatorOptions {
  machine: MachineTranslator | null
  isOnline?: () => boolean
  /** Machine translations kept per session. Default 100. */
  cacheSize?: number
}

export function createQueryTranslator(options: QueryTranslatorOptions): QueryTranslator {
  const isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine)
  const capacity = options.cacheSize ?? 100
  const cache = new Map<string, string | null>()

  const remember = (key: string, value: string | null) => {
    cache.delete(key)
    cache.set(key, value)
    if (cache.size > capacity) cache.delete(cache.keys().next().value as string)
  }

  return {
    translateNow: translateWithDictionary,
    async translate(text, signal) {
      const instant = translateWithDictionary(text)
      if (instant === null || instant.source === 'dictionary' || !options.machine) return instant
      let machine = cache.get(instant.original)
      if (machine === undefined) {
        if (!isOnline()) return instant
        machine = await options.machine.translate(instant.original, signal)
        // Failures are not cached: the next search may succeed (e.g. back online).
        if (machine !== null) remember(instant.original, machine)
      }
      return machine ? { original: instant.original, query: machine, source: 'machine', unknown: [] } : instant
    },
  }
}
