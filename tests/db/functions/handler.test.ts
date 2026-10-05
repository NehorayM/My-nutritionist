import { describe, expect, it } from 'vitest'
import { FDC_NUTRIENT_NUMBERS } from '../../../supabase/functions/_shared/usda/normalize.ts'
import { createFoodSearchHandler, SEARCH_TTL_MS, type FoodSearchDeps } from '../../../supabase/functions/food-search/handler.ts'
import { FDC_BASE_URL } from '../../../supabase/functions/food-search/upstream.ts'
import { FOOD_BODY, fakeFetch, hangingFetch, jsonReply, lastCall, SEARCH_BODY } from './fixtures.ts'

const AUTH = 'Bearer user-session-jwt'
const API_KEY = 'test-fdc-key'
const URL = 'http://127.0.0.1:54321/functions/v1/food-search'

function setup(overrides: Partial<Omit<FoodSearchDeps, 'fetch'>> & { fetch?: ReturnType<typeof fakeFetch> } = {}) {
  let now = 1_000_000
  const logs: string[] = []
  const fetchMock = overrides.fetch ?? fakeFetch()
  const handler = createFoodSearchHandler({
    verifyUser: async (header) => (header === AUTH ? 'user-1' : null),
    getApiKey: () => API_KEY,
    now: () => now,
    log: (message) => logs.push(message),
    ...overrides,
    fetch: fetchMock,
  })
  return { handler, fetchMock, logs, advance: (ms: number) => (now += ms) }
}

function post(body: unknown, authorization: string | null = AUTH): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authorization !== null) headers.Authorization = authorization
  return new Request(URL, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

async function errorOf(response: Response): Promise<{ status: number; code: string; cors: string | null }> {
  const body = (await response.json()) as { error: { code: string; message: string } }
  expect(body.error.message.length).toBeGreaterThan(0)
  return { status: response.status, code: body.error.code, cors: response.headers.get('Access-Control-Allow-Origin') }
}

const SEARCH = { action: 'search', query: 'Chicken Breast', page: 1, pageSize: 5, scope: 'generic' }

describe('protocol', () => {
  it('answers the CORS preflight with the Supabase client headers allowed', async () => {
    const response = await setup().handler(new Request(URL, { method: 'OPTIONS' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const allowed = response.headers.get('Access-Control-Allow-Headers') ?? ''
    for (const header of ['authorization', 'apikey', 'x-client-info', 'content-type']) expect(allowed).toContain(header)
  })

  it('rejects other methods with 405', async () => {
    const response = await setup().handler(new Request(URL, { method: 'GET' }))
    expect(response.headers.get('Allow')).toBe('POST, OPTIONS')
    expect(await errorOf(response)).toEqual({ status: 405, code: 'method_not_allowed', cors: '*' })
  })

  it('rejects callers without a signed-in user before reading the body or calling USDA', async () => {
    const { handler, fetchMock } = setup()
    for (const authorization of [null, 'Bearer sb_publishable_xyz']) {
      expect(await errorOf(await handler(post(SEARCH, authorization)))).toEqual({ status: 401, code: 'unauthorized', cors: '*' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 when the function cannot verify users', async () => {
    expect(await errorOf(await setup({ verifyUser: null }).handler(post(SEARCH)))).toMatchObject({ status: 503, code: 'not_configured' })
  })

  it.each([
    ['malformed JSON', '{"action": "search", '],
    ['an invalid query', { action: 'search', query: 'a' }],
    ['an unknown action', { action: 'list' }],
  ])('answers 400 for %s without calling USDA', async (_label, body) => {
    const { handler, fetchMock } = setup()
    expect(await errorOf(await handler(post(body)))).toEqual({ status: 400, code: 'invalid_request', cors: '*' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a declared oversized body without reading it', async () => {
    const { handler, fetchMock } = setup()
    const request = new Request(URL, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Length': '1000000' },
      body: JSON.stringify(SEARCH),
    })
    expect(await errorOf(await handler(request))).toEqual({ status: 400, code: 'invalid_request', cors: '*' })
    expect(request.bodyUsed).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 when FDC_API_KEY is not configured', async () => {
    const { handler, fetchMock } = setup({ getApiKey: () => null })
    expect(await errorOf(await handler(post(SEARCH)))).toMatchObject({ status: 503, code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('search', () => {
  it('POSTs /foods/search with the generic data types and returns normalized foods', async () => {
    const { handler, fetchMock } = setup({ fetch: fakeFetch(jsonReply(SEARCH_BODY)) })
    const response = await handler(post(SEARCH))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    const body = (await response.json()) as { foods: Array<{ externalId: string; per100g: Record<string, number | null> }> }
    expect(body).toMatchObject({ page: 1, pageSize: 5, totalHits: 2, totalPages: 1 })
    expect(body.foods.map((food) => food.externalId)).toEqual(['171477'])
    expect(body.foods[0]?.per100g).toMatchObject({ calories: 165, protein: 31.02, fiber: null })

    const { url, init } = lastCall(fetchMock)
    expect(url).toBe(`${FDC_BASE_URL}/foods/search`)
    expect(url).not.toContain(API_KEY)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({
      query: 'Chicken Breast',
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
      pageSize: 5,
      pageNumber: 1,
    })
  })

  it('searches only branded products for the branded scope', async () => {
    const { handler, fetchMock } = setup({ fetch: fakeFetch(jsonReply({ ...SEARCH_BODY, foods: [] })) })
    await handler(post({ ...SEARCH, scope: 'branded', page: 3 }))
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toMatchObject({ dataType: ['Branded'], pageNumber: 3 })
  })

  it('serves a repeated search from the cache for 24 hours', async () => {
    const { handler, fetchMock, advance } = setup({ fetch: fakeFetch(jsonReply(SEARCH_BODY), jsonReply(SEARCH_BODY)) })
    expect((await handler(post(SEARCH))).status).toBe(200)
    const cached = await handler(post({ ...SEARCH, query: '  chicken   breast ' }))
    expect(cached.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    advance(SEARCH_TTL_MS)
    expect((await handler(post(SEARCH))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures', async () => {
    const { handler, fetchMock } = setup({ fetch: fakeFetch(jsonReply({}, 500), jsonReply(SEARCH_BODY)) })
    expect((await handler(post(SEARCH))).status).toBe(502)
    expect((await handler(post(SEARCH))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('food detail', () => {
  it('GETs /food/{id} in full format filtered to the mapped nutrients', async () => {
    const { handler, fetchMock } = setup({ fetch: fakeFetch(jsonReply(FOOD_BODY)) })
    const response = await handler(post({ action: 'food', fdcId: 171688 }))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { food: { externalId: string; servings: unknown[]; attribution: string } }
    expect(body.food).toMatchObject({ externalId: '171688', attribution: 'USDA FoodData Central · SR Legacy #171688' })
    expect(body.food.servings.length).toBeGreaterThan(0)
    const { url, init } = lastCall(fetchMock)
    expect(url).toBe(`${FDC_BASE_URL}/food/171688?format=full&nutrients=${FDC_NUTRIENT_NUMBERS.join(',')}`)
    expect(FDC_NUTRIENT_NUMBERS.length).toBeLessThanOrEqual(25)
    expect(init).toMatchObject({ method: 'GET', headers: { 'X-Api-Key': API_KEY } })
  })

  it('answers 404 for an unknown or unusable food', async () => {
    const { handler } = setup({ fetch: fakeFetch(jsonReply({}, 404), jsonReply({ ...FOOD_BODY, foodNutrients: [] })) })
    expect(await errorOf(await handler(post({ action: 'food', fdcId: 1 })))).toMatchObject({ status: 404, code: 'not_found' })
    expect(await errorOf(await handler(post({ action: 'food', fdcId: 2 })))).toMatchObject({ status: 404, code: 'not_found' })
  })
})

describe('upstream failures', () => {
  it('forwards Retry-After on 429 and exposes it to browsers', async () => {
    const { handler } = setup({ fetch: fakeFetch(jsonReply({}, 429, { 'Retry-After': '120' })) })
    const response = await handler(post(SEARCH))
    expect(response.headers.get('Retry-After')).toBe('120')
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After')
    expect(await errorOf(response)).toMatchObject({ status: 429, code: 'rate_limited' })
  })

  it('uses Retry-After 3600 when upstream omits it', async () => {
    const response = await setup({ fetch: fakeFetch(jsonReply({}, 429)) }).handler(post({ action: 'food', fdcId: 5 }))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('3600')
  })

  it.each([
    ['a 500 answer', () => jsonReply({ error: 'boom' }, 500)],
    ['a 403 answer (invalid key)', () => jsonReply({ error: { code: 'API_KEY_INVALID' } }, 403)],
    ['a 404 answer to a search', () => jsonReply({}, 404)],
    ['malformed JSON', () => new Response('<html>oops</html>', { status: 200 })],
    ['an envelope without foods', () => jsonReply({ totalHits: 3 })],
    ['a network error', () => new TypeError('fetch failed')],
  ])('maps %s to 502 upstream_error', async (_label, reply) => {
    const { handler, logs } = setup({ fetch: fakeFetch(reply()) })
    expect(await errorOf(await handler(post(SEARCH)))).toEqual({ status: 502, code: 'upstream_error', cors: '*' })
    expect(logs.length).toBe(1)
  })

  it('maps an upstream slower than the timeout to 504', async () => {
    const { handler } = setup({ fetch: hangingFetch(), timeoutMs: 20 })
    expect(await errorOf(await handler(post(SEARCH)))).toEqual({ status: 504, code: 'timeout', cors: '*' })
  })
})
