import { describe, expect, it, vi } from 'vitest'
import { isUuid } from '@/lib/id'
import invalidCode from '../__fixtures__/off-product-invalid-code.json'
import notFound from '../__fixtures__/off-product-not-found.json'
import nutella from '../__fixtures__/off-product-nutella.json'
import hummusSearch from '../__fixtures__/off-search-hummus.json'
import israelSearch from '../__fixtures__/off-search-israel.json'
import { createOpenFoodFactsProvider, type OpenFoodFactsProviderOptions } from './openFoodFactsProvider'
import { FoodProviderError } from './types'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

function setup(responder: () => Response | Promise<Response>, options: Partial<OpenFoodFactsProviderOptions> = {}) {
  let clock = 1_000_000
  const fetch = vi.fn<typeof globalThis.fetch>(async () => responder())
  const provider = createOpenFoodFactsProvider({ fetch, now: () => clock, ...options })
  return { provider, fetch, advance: (ms: number) => (clock += ms) }
}

async function providerError(promise: Promise<unknown>): Promise<FoodProviderError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!(error instanceof FoodProviderError)) throw new Error(`expected FoodProviderError, got ${String(error)}`)
  return error
}

const searchRequest = { text: '  hummus ', page: 1, pageSize: 15 }

/** fetch that never answers until its signal aborts, like a stalled network request. */
const hangingFetch: typeof globalThis.fetch = (_input, init) =>
  new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))

describe('Open Food Facts packaged search', () => {
  it('calls the legacy full-text endpoint with limited fields and the X-User-Agent header', async () => {
    const { provider, fetch } = setup(() => json(hummusSearch))
    const page = await provider.searchPackaged(searchRequest)
    const [url, init] = fetch.mock.calls[0]!
    const parsed = new URL(String(url))
    expect(parsed.origin + parsed.pathname).toBe('https://world.openfoodfacts.org/cgi/search.pl')
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      search_terms: 'hummus',
      search_simple: '1',
      action: 'process',
      json: '1',
      page: '1',
      page_size: '15',
    })
    expect(parsed.searchParams.get('fields')?.split(',')).toContain('nutriments')
    expect(new Headers(init?.headers).get('X-User-Agent')).toBe('My-nutritionist/1.0 (https://github.com/my-nutritionist)')
    expect(page.providerId).toBe('off')
    expect(page.items.map((item) => item.name)).toEqual(['Hummus Classic', 'Houmous bio', 'Houmous'])
    expect(page.items.every((item) => item.source === 'off' && isUuid(item.id))).toBe(true)
    expect(page.hasMore).toBe(true)
  })

  it('drops unusable products and reports the last page', async () => {
    const { provider } = setup(() => json({ ...israelSearch, count: 4, page: 1, page_size: 15 }))
    const page = await provider.search(searchRequest)
    // Mineral water has no nutrition facts and is dropped.
    expect(page.items.map((item) => item.name)).toEqual(['חלב טרי 3%', 'קפה נמס'])
    expect(page.hasMore).toBe(false)
  })

  it('handles an empty result set', async () => {
    const { provider } = setup(() => json({ count: 0, page: 1, page_size: 15, products: [] }))
    expect(await provider.searchPackaged(searchRequest)).toEqual({ providerId: 'off', items: [], page: 1, hasMore: false })
  })

  it('does not call the API for a blank query', async () => {
    const { provider, fetch } = setup(() => json(hummusSearch))
    expect((await provider.searchPackaged({ text: '   ', page: 1, pageSize: 15 })).items).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows one search per 6 s client-side and tells the caller when to retry', async () => {
    const { provider, fetch, advance } = setup(() => json(hummusSearch))
    await provider.searchPackaged(searchRequest)
    const error = await providerError(provider.searchPackaged(searchRequest))
    expect(error.kind).toBe('rate_limited')
    expect(error.retryAfterMs).toBe(6000)
    expect(fetch).toHaveBeenCalledTimes(1)
    advance(6000)
    await provider.searchPackaged(searchRequest)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['malformed JSON', () => new Response('<html>busy</html>', { status: 200 }), 'invalid_response'],
    ['an unexpected envelope', () => json({ hits: [] }), 'invalid_response'],
    ['HTTP 503', () => json({}, 503), 'unavailable'],
    ['HTTP 500', () => json({}, 500), 'unavailable'],
    ['HTTP 400', () => json({}, 400), 'http'],
    ['HTTP 404', () => json({}, 404), 'http'],
  ])('maps %s to %s', async (_label, responder, kind) => {
    const { provider } = setup(responder)
    expect((await providerError(provider.searchPackaged(searchRequest))).kind).toBe(kind)
  })
})

describe('Open Food Facts barcode lookup', () => {
  it('returns a normalized product for a found barcode', async () => {
    const { provider, fetch } = setup(() => json(nutella))
    const result = await provider.lookupBarcodeDetailed('3017624010701')
    expect(String(fetch.mock.calls[0]![0])).toMatch(/\/api\/v2\/product\/3017624010701\?fields=code%2Cproduct_name/)
    expect(result).toMatchObject({ status: 'found', food: { name: 'Nutella', externalId: '3017624010701' } })
    expect((await provider.lookupBarcode('3017624010701'))?.name).toBe('Nutella')
  })

  it('maps HTTP 404 to not found', async () => {
    const { provider } = setup(() => json(notFound, 404))
    expect(await provider.lookupBarcodeDetailed('7290000000008')).toEqual({ status: 'not_found' })
    expect(await provider.lookupBarcode('7290000000008')).toBeNull()
  })

  it('checks the JSON status: HTTP 200 with status 0 is an invalid code', async () => {
    const { provider } = setup(() => json(invalidCode))
    expect(await provider.lookupBarcodeDetailed('00000017')).toEqual({ status: 'invalid_code' })
  })

  it('treats status 0 without "invalid" as not found', async () => {
    const { provider } = setup(() => json({ status: 0, status_verbose: 'product not found' }))
    expect(await provider.lookupBarcodeDetailed('7290000000008')).toEqual({ status: 'not_found' })
  })

  it('rejects malformed codes without a network call', async () => {
    const { provider, fetch } = setup(() => json(nutella))
    expect(await provider.lookupBarcodeDetailed('12-ab')).toEqual({ status: 'invalid_code' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports products without usable nutrition as incomplete', async () => {
    const water = israelSearch.products[1]
    const { provider } = setup(() => json({ status: 1, product: water }))
    expect(await provider.lookupBarcodeDetailed('7290019056942')).toEqual({ status: 'incomplete', productName: 'מים מינרליים' })
  })

  it('maps an invalid product payload to invalid_response', async () => {
    const { provider } = setup(() => json({ status: 1, product: { product_name: 42 } }))
    expect((await providerError(provider.lookupBarcodeDetailed('3017624010701'))).kind).toBe('invalid_response')
  })

  it('maps 429 to rate_limited with Retry-After and blocks further calls locally', async () => {
    const { provider, fetch } = setup(() => json({}, 429, { 'Retry-After': '30' }))
    const error = await providerError(provider.lookupBarcodeDetailed('3017624010701'))
    expect(error).toMatchObject({ kind: 'rate_limited', retryAfterMs: 30_000, providerId: 'off' })
    const blocked = await providerError(provider.lookupBarcodeDetailed('3017624010701'))
    expect(blocked.kind).toBe('rate_limited')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('assumes one minute when a 429 has no Retry-After', async () => {
    const { provider } = setup(() => json({}, 429))
    expect((await providerError(provider.lookupBarcodeDetailed('3017624010701'))).retryAfterMs).toBe(60_000)
  })

  it('allows a burst of 3 product reads, then ≤ 1 per 5 s', async () => {
    const { provider, fetch, advance } = setup(() => json(nutella))
    for (let i = 0; i < 3; i += 1) await provider.lookupBarcodeDetailed('3017624010701')
    const error = await providerError(provider.lookupBarcodeDetailed('3017624010701'))
    expect(error.retryAfterMs).toBe(5000)
    advance(5000)
    await provider.lookupBarcodeDetailed('3017624010701')
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('maps network failures, timeouts and aborts', async () => {
    const offline = setup(() => Promise.reject(new TypeError('Failed to fetch')))
    expect((await providerError(offline.provider.lookupBarcodeDetailed('3017624010701'))).kind).toBe('network')

    const stalled = createOpenFoodFactsProvider({ fetch: hangingFetch })
    const timeout = new AbortController()
    const timedOut = providerError(stalled.lookupBarcodeDetailed('3017624010701', timeout.signal))
    timeout.abort(new DOMException('slow', 'TimeoutError'))
    expect((await timedOut).kind).toBe('timeout')

    const cancel = new AbortController()
    const cancelled = providerError(stalled.searchPackaged({ ...searchRequest, signal: cancel.signal }))
    cancel.abort()
    expect((await cancelled).kind).toBe('aborted')
  })

  it('fails fast when the signal is already aborted', async () => {
    const { provider, fetch } = setup(() => json(nutella))
    const controller = new AbortController()
    controller.abort()
    expect((await providerError(provider.lookupBarcodeDetailed('3017624010701', controller.signal))).kind).toBe('aborted')
    expect(fetch).not.toHaveBeenCalled()
  })
})
