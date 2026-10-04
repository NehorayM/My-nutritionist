import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { isUuid } from '@/lib/id'
import {
  normalizeUsdaFoodResponse,
  normalizeUsdaSearchResponse,
} from '../../../../supabase/functions/_shared/usda/normalize.ts'
import fullFoods from '../__fixtures__/usda-food-full.json'
import genericSearch from '../__fixtures__/usda-search-generic.json'
import { FoodProviderError } from './types'
import { createUsdaProvider, type InvokeFunction, type UsdaProviderOptions } from './usdaProvider'

/** Realistic function output: the fixtures run through the same normalizer the Edge Function uses. */
const searchBody = normalizeUsdaSearchResponse(genericSearch, { page: 1, pageSize: 15 })!
const cheddarBody = normalizeUsdaFoodResponse((fullFoods as unknown[])[2])!

const ok = (data: unknown) => ({ data, error: null })
const failed = (error: unknown) => ({ data: null, error })
const httpError = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  failed(new FunctionsHttpError(new Response(JSON.stringify(body), { status, headers })))

function setup(answer: () => { data: unknown; error: unknown }, options: Partial<UsdaProviderOptions> = {}) {
  let clock = 5_000_000
  const invoke = vi.fn<InvokeFunction>(async () => answer())
  const provider = createUsdaProvider({ invoke, isAvailable: () => true, now: () => clock, ...options })
  return { provider, invoke, advance: (ms: number) => (clock += ms) }
}

async function providerError(promise: Promise<unknown>): Promise<FoodProviderError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!(error instanceof FoodProviderError)) throw new Error(`expected FoodProviderError, got ${String(error)}`)
  return error
}

const request = { text: '  cheddar   cheese ', page: 1, pageSize: 15 }

describe('USDA provider search', () => {
  it('sends a contract request and returns validated foods with transient ids', async () => {
    const { provider, invoke } = setup(() => ok({ ...searchBody, totalPages: 3 }))
    const page = await provider.search(request)
    expect(invoke).toHaveBeenCalledWith('food-search', {
      body: { action: 'search', query: 'cheddar cheese', page: 1, pageSize: 15, scope: 'generic' },
      signal: undefined,
    })
    expect(page.providerId).toBe('usda')
    expect(page.hasMore).toBe(true)
    expect(page.items.map((item) => item.externalId)).toEqual(['2705709', '328637'])
    const [survey] = page.items
    expect(isUuid(survey!.id)).toBe(true)
    expect(survey).toMatchObject({ source: 'usda', allergens: null, createdBy: null, category: null })
    expect(survey?.per100g.calories).toBe(409)
    expect(survey?.attribution).toBe('USDA FoodData Central · Survey (FNDDS) #2705709')
  })

  it('supports the branded scope, clamps the page size and reports the last page', async () => {
    const { provider, invoke } = setup(() => ok({ ...searchBody, page: 2, totalPages: 2 }))
    const page = await provider.search({ text: 'cheddar', page: 2, pageSize: 500, scope: 'branded' })
    expect(invoke.mock.calls[0]?.[1].body).toEqual({ action: 'search', query: 'cheddar', page: 2, pageSize: 50, scope: 'branded' })
    expect(page.hasMore).toBe(false)
  })

  it('does not call the function for queries under 2 characters or pages beyond 50', async () => {
    const { provider, invoke } = setup(() => ok(searchBody))
    expect((await provider.search({ ...request, text: ' a ' })).items).toEqual([])
    expect((await provider.search({ ...request, page: 51 })).hasMore).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('refuses to call the function when unavailable (guest mode)', async () => {
    const { provider, invoke } = setup(() => ok(searchBody), { isAvailable: () => false })
    expect(provider.isAvailable()).toBe(false)
    expect((await providerError(provider.search(request))).kind).toBe('unavailable')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('skips individual items that break the contract but rejects a page where none match', async () => {
    const broken = { ...searchBody.foods[0], per100g: { calories: -5 } }
    const partial = setup(() => ok({ ...searchBody, foods: [broken, searchBody.foods[1]] }))
    expect((await partial.provider.search(request)).items.map((item) => item.externalId)).toEqual(['328637'])
    const none = setup(() => ok({ ...searchBody, foods: [broken] }))
    expect((await providerError(none.provider.search(request))).kind).toBe('invalid_response')
    const envelope = setup(() => ok('<html>gateway</html>'))
    expect((await providerError(envelope.provider.search(request))).kind).toBe('invalid_response')
  })
})

describe('USDA provider error mapping', () => {
  it.each([
    ['HTTP 503 not_configured', () => httpError(503, { error: { code: 'not_configured' } }), 'unavailable'],
    ['HTTP 502 upstream_error', () => httpError(502), 'unavailable'],
    ['HTTP 404 on search', () => httpError(404, { error: { code: 'not_found' } }), 'unavailable'],
    ['HTTP 504', () => httpError(504), 'timeout'],
    ['HTTP 401', () => httpError(401), 'unavailable'],
    ['HTTP 400', () => httpError(400, { error: { code: 'invalid_request' } }), 'http'],
    ['a relay error', () => failed(new FunctionsRelayError(new Response('', { status: 502 }))), 'unavailable'],
    ['a fetch error', () => failed(new FunctionsFetchError(new TypeError('Failed to fetch'))), 'network'],
    ['malformed JSON', () => failed(new SyntaxError('Unexpected token <')), 'invalid_response'],
  ])('maps %s to %s', async (_label, answer, kind) => {
    const { provider } = setup(answer)
    expect((await providerError(provider.search(request))).kind).toBe(kind)
  })

  it('maps a thrown invoke to a network error', async () => {
    const provider = createUsdaProvider({ invoke: () => Promise.reject(new TypeError('offline')), isAvailable: () => true })
    expect((await providerError(provider.search(request))).kind).toBe('network')
  })

  it('maps 429 to rate_limited with Retry-After and pauses calls until then', async () => {
    const { provider, invoke, advance } = setup(() => httpError(429, { error: { code: 'rate_limited' } }, { 'Retry-After': '120' }))
    expect(await providerError(provider.search(request))).toMatchObject({ kind: 'rate_limited', retryAfterMs: 120_000 })
    advance(20_000)
    expect(await providerError(provider.search(request))).toMatchObject({ kind: 'rate_limited', retryAfterMs: 100_000 })
    expect(invoke).toHaveBeenCalledTimes(1)
    advance(100_000)
    await providerError(provider.search(request))
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('assumes one hour when the 429 has no readable Retry-After', async () => {
    const { provider } = setup(() => httpError(429))
    expect((await providerError(provider.search(request))).retryAfterMs).toBe(3_600_000)
  })

  it('distinguishes cancellation from timeouts', async () => {
    const before = new AbortController()
    before.abort()
    const idle = setup(() => ok(searchBody))
    expect((await providerError(idle.provider.search({ ...request, signal: before.signal }))).kind).toBe('aborted')
    expect(idle.invoke).not.toHaveBeenCalled()

    const timeout = new AbortController()
    const slow = setup(() => {
      timeout.abort(new DOMException('slow', 'TimeoutError'))
      return failed(new FunctionsFetchError(new DOMException('aborted', 'AbortError')))
    })
    expect((await providerError(slow.provider.search({ ...request, signal: timeout.signal }))).kind).toBe('timeout')
    expect(slow.invoke.mock.calls[0]?.[1].signal).toBe(timeout.signal)
  })
})

describe('USDA provider food detail', () => {
  it('returns the normalized full detail with all portions', async () => {
    const { provider, invoke } = setup(() => ok(cheddarBody))
    const food = await provider.getFood('173414')
    expect(invoke.mock.calls[0]?.[1].body).toEqual({ action: 'food', fdcId: 173414 })
    expect(food).toMatchObject({ externalId: '173414', source: 'usda' })
    expect(food?.servings.length).toBeGreaterThan(3)
  })

  it('resolves null for an unknown fdcId and for malformed ids without calling', async () => {
    const missing = setup(() => httpError(404, { error: { code: 'not_found', message: 'Unknown food' } }))
    expect(await missing.provider.getFood(999_999_999)).toBeNull()
    expect(await missing.provider.getFood('12a')).toBeNull()
    expect(await missing.provider.getFood(-1)).toBeNull()
    expect(missing.invoke).toHaveBeenCalledTimes(1)
  })

  it('treats a 404 without the not_found code as an undeployed function', async () => {
    const { provider } = setup(() => httpError(404, 'Function not found'))
    expect((await providerError(provider.getFood(173414))).kind).toBe('unavailable')
  })

  it('rejects a detail that breaks the contract', async () => {
    const { provider } = setup(() => ok({ food: { externalId: '173414' } }))
    expect((await providerError(provider.getFood(173414))).kind).toBe('invalid_response')
  })
})
