import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  fetchUsdaFood,
  normalizeRetryAfter,
  searchUsdaFoods,
} from '../../../supabase/functions/food-search/upstream.ts'
import { fakeFetch, hangingFetch, jsonReply, lastCall } from './fixtures.ts'

describe('normalizeRetryAfter', () => {
  it('forwards delay-seconds and HTTP dates unchanged', () => {
    expect(normalizeRetryAfter('120')).toBe('120')
    expect(normalizeRetryAfter(' 0 ')).toBe('0')
    expect(normalizeRetryAfter('Sun, 04 Oct 2026 18:00:00 GMT')).toBe('Sun, 04 Oct 2026 18:00:00 GMT')
  })

  it.each([
    ['missing', null],
    ['empty', ''],
    ['negative', '-5'],
    ['fractional', '1.5'],
    ['garbage', 'soon'],
  ])('replaces a %s value with one hour', (_label, value) => {
    expect(normalizeRetryAfter(value)).toBe(DEFAULT_RETRY_AFTER_SECONDS)
  })
})

describe('USDA calls', () => {
  const request = { action: 'search', query: 'oats', page: 2, pageSize: 10, scope: 'generic' } as const

  it('uses a custom base URL and sends the key only in a header', async () => {
    const fetchMock = fakeFetch(jsonReply({ foods: [] }))
    const result = await searchUsdaFoods({ apiKey: 'k-1', fetch: fetchMock, baseUrl: 'https://fdc.test/v1' }, request)
    expect(result).toEqual({ kind: 'ok', body: { foods: [] } })
    const { url, init } = lastCall(fetchMock)
    expect(url).toBe('https://fdc.test/v1/foods/search')
    expect(init.headers).toEqual({ Accept: 'application/json', 'X-Api-Key': 'k-1', 'Content-Type': 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('sends no body and no content type for a food lookup', async () => {
    const fetchMock = fakeFetch(jsonReply({ fdcId: 1 }))
    await fetchUsdaFood({ apiKey: 'k-1', fetch: fetchMock }, 1)
    const { init } = lastCall(fetchMock)
    expect(init.body).toBeUndefined()
    expect(init.headers).toEqual({ Accept: 'application/json', 'X-Api-Key': 'k-1' })
  })

  it('reports a timeout distinctly from other failures', async () => {
    await expect(searchUsdaFoods({ apiKey: 'k', fetch: hangingFetch(), timeoutMs: 10 }, request)).resolves.toEqual({
      kind: 'timeout',
    })
    await expect(searchUsdaFoods({ apiKey: 'k', fetch: fakeFetch(new TypeError('offline')) }, request)).resolves.toEqual({
      kind: 'failed',
      status: null,
      reason: 'network',
    })
  })
})
