/**
 * Machine translation Hebrew → English for food words the built-in dictionary does not know, via the free
 * MyMemory API (no key; ~5,000 characters per day per network). Only the search text is sent — only when the
 * dictionary could not translate it and the device is online. Failures (offline, timeout, quota) return null and
 * the search continues with the dictionary's partial translation.
 */
export interface MachineTranslator {
  translate(text: string, signal?: AbortSignal): Promise<string | null>
}

export const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'
export const MACHINE_TIMEOUT_MS = 2500
const MAX_CHARS = 200

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** "Grilled Chicken Breast." → "grilled chicken breast"; null for empty or obviously failed answers. */
export function cleanTranslation(source: string, value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[."“”'’!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (text.length === 0 || text.length > MAX_CHARS * 2 || /[א-ת]/.test(text) || text.includes('mymemory') || text === source.toLowerCase()) {
    return null
  }
  return text
}

export function createMyMemoryTranslator(fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init), timeoutMs = MACHINE_TIMEOUT_MS): MachineTranslator {
  return {
    async translate(text, signal) {
      const source = text.trim().slice(0, MAX_CHARS)
      if (source.length === 0) return null
      const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(source)}&langpair=he|en`
      const timeout = AbortSignal.timeout(timeoutMs)
      try {
        const response = await fetchImpl(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
        if (!response.ok) return null
        const body: unknown = await response.json()
        if (typeof body !== 'object' || body === null) return null
        if (Reflect.get(body, 'responseStatus') !== 200 || Reflect.get(body, 'quotaFinished') === true) return null
        const data: unknown = Reflect.get(body, 'responseData')
        return cleanTranslation(source, typeof data === 'object' && data !== null ? Reflect.get(data, 'translatedText') : null)
      } catch (error) {
        if (signal?.aborted) throw error
        return null
      }
    },
  }
}
