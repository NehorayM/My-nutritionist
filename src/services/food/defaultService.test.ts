import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories/local'
import { setRepositories } from '@/services/runtime'
import { normalizeUsdaSearchResponse } from '../../../supabase/functions/_shared/usda/normalize.ts'
import { testFood } from './__fixtures__/foods'
import genericSearch from './__fixtures__/usda-search-generic.json'
import { createDefaultFoodSearchService, getFoodSearchService } from './defaultService'

const SUPABASE_URL = 'http://127.0.0.1:54321'

/** A real supabase-js client whose HTTP traffic goes to `respond`, so invoke + its error classes are exercised. */
function clientAnswering(respond: (url: string, init: RequestInit | undefined) => Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => respond(String(input), init))
  const client = createClient(SUPABASE_URL, 'sb_publishable_test_key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  })
  return { client, fetch }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

describe('default food search wiring', () => {
  it('searches the bundled catalog plus user foods offline, without USDA', async () => {
    const own = testFood('Hummus with mushrooms', { id: 'own-hummus', source: 'custom', createdBy: 'guest' })
    const service = createDefaultFoodSearchService({ supabase: null, getUserFoods: async () => [own] })
    const result = await service.search('chumus')
    expect(result.items.map((item) => item.name)).toEqual(['Hummus', 'Hummus with mushrooms'])
    expect(result.providerStatus).toEqual({ local: 'ok', usda: 'skipped', off: 'skipped' })
  })

  it('reads user foods from the active repositories, and none before bootstrap', async () => {
    const service = createDefaultFoodSearchService({ supabase: null })
    expect((await service.search('falafel')).items.map((item) => item.name)).toEqual(['Falafel'])
    const guestId = newId()
    const repositories = createLocalRepositories(guestId)
    await repositories.foods.save(testFood('Falafel plate', { id: newId(), source: 'custom', createdBy: guestId }))
    setRepositories(repositories)
    try {
      expect((await service.search('falafel')).items.map((item) => item.name)).toEqual(['Falafel', 'Falafel plate'])
    } finally {
      setRepositories(null)
    }
  })

  it('keeps USDA unavailable without a signed-in session', async () => {
    const { client, fetch } = clientAnswering(() => json({}))
    const result = await createDefaultFoodSearchService({ supabase: client, getUserFoods: async () => [] }).search('cheddar')
    expect(result.providerStatus.usda).toBe('skipped')
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/functions/v1/'))).toBe(false)
  })

  it('calls the food-search Edge Function through supabase-js and merges its results', async () => {
    const body = normalizeUsdaSearchResponse(genericSearch, { page: 1, pageSize: 15 })
    const { client, fetch } = clientAnswering(() => json(body))
    const service = createDefaultFoodSearchService({ supabase: client, getUserFoods: async () => [], isUsdaAvailable: () => true })
    const result = await service.search('cheddar')
    const [url, init] = fetch.mock.calls.find(([input]) => String(input).includes('/functions/v1/food-search')) ?? []
    expect(String(url)).toBe(`${SUPABASE_URL}/functions/v1/food-search`)
    expect(JSON.parse(String(init?.body))).toEqual({ action: 'search', query: 'cheddar', page: 1, pageSize: 15, scope: 'generic' })
    expect(result.providerStatus.usda).toBe('ok')
    // "Cheese, Cheddar" duplicates the catalog's "Cheddar cheese" and is dropped.
    expect(result.items.map((item) => item.name)).toEqual(['Cheddar cheese'])
  })

  it('does not list a USDA record that a catalog food was built from twice', async () => {
    const dto = (externalId: string, name: string) => ({
      externalId,
      name,
      brand: null,
      barcode: null,
      dataType: 'sr_legacy',
      per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      servings: [],
      attribution: `USDA FoodData Central · SR Legacy #${externalId}`,
    })
    const foods = [
      dto('171477', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'), // catalog source record
      dto('171140', 'Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw'),
    ]
    const { client } = clientAnswering(() => json({ page: 1, pageSize: 15, totalHits: 2, totalPages: 1, foods }))
    const service = createDefaultFoodSearchService({ supabase: client, getUserFoods: async () => [], isUsdaAvailable: () => true })
    const result = await service.search('chicken breast')
    expect(result.items.map((item) => item.externalId)).toEqual(['chicken_breast_roasted', '171140'])
  })

  it('maps a 429 from the function, including Retry-After, through the real supabase-js error', async () => {
    const { client } = clientAnswering(() => json({ error: { code: 'rate_limited', message: 'Slow down' } }, 429, { 'Retry-After': '90' }))
    const service = createDefaultFoodSearchService({ supabase: client, getUserFoods: async () => [], isUsdaAvailable: () => true })
    const result = await service.search('cheddar')
    expect(result.providerStatus.usda).toBe('rate_limited')
    expect(result.errors.usda?.retryAfterMs).toBe(90_000)
  })

  it('reports USDA as unavailable when it is enabled but Supabase is not configured', async () => {
    const service = createDefaultFoodSearchService({ supabase: null, getUserFoods: async () => [], isUsdaAvailable: () => true })
    expect((await service.search('cheddar')).providerStatus.usda).toBe('unavailable')
  })

  it('shares one app-wide instance', () => {
    expect(getFoodSearchService()).toBe(getFoodSearchService())
  })
})
