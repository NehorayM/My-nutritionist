import { describe, expect, it } from 'vitest'
import type { FoodItem } from '@/types'
import { fakeOff, fakeUsda, hangUntilAborted, page, remoteFood } from './__fixtures__/fakeProviders'
import { TEST_CATALOG, testFood } from './__fixtures__/foods'
import { createFoodSearchService } from './foodSearchService'
import { createLocalCatalogProvider } from './providers/localCatalogProvider'
import { FoodProviderError } from './providers/types'

function localProvider(userFoods: readonly FoodItem[] = []) {
  return createLocalCatalogProvider({ catalog: TEST_CATALOG, getUserFoods: async () => userFoods })
}

describe('searchPackaged (explicit Open Food Facts action)', () => {
  it('queries only Open Food Facts with the remote page size', async () => {
    const off = fakeOff()
    off.searchPackaged.mockResolvedValue(page('off', [remoteFood('off', 'Hummus Classic', { barcode: '7290000066318' })], true))
    const usda = fakeUsda(async () => page('usda', []))
    const result = await createFoodSearchService({ local: localProvider(), usda, off }).searchPackaged(' hummus ', { page: 2 })
    expect(off.searchPackaged).toHaveBeenCalledWith(expect.objectContaining({ text: 'hummus', page: 2, pageSize: 15 }))
    expect(usda.search).not.toHaveBeenCalled()
    expect(result).toMatchObject({ query: 'hummus', page: 2, hasMore: true })
    expect(result.items.map((item) => item.name)).toEqual(['Hummus Classic'])
    expect(result.providerStatus).toEqual({ local: 'skipped', usda: 'skipped', off: 'ok' })
  })

  it('surfaces the client rate limit with its retry delay and caches successful pages', async () => {
    const off = fakeOff()
    const service = createFoodSearchService({ local: localProvider(), off })
    await service.searchPackaged('tahini')
    await service.searchPackaged('Tahini')
    expect(off.searchPackaged).toHaveBeenCalledTimes(1)
    off.searchPackaged.mockRejectedValueOnce(new FoodProviderError('off', 'rate_limited', 'wait', 6000))
    const limited = await service.searchPackaged('halva')
    expect(limited.providerStatus.off).toBe('rate_limited')
    expect(limited.errors.off?.retryAfterMs).toBe(6000)
    expect(limited.items).toEqual([])
  })

  it('skips Open Food Facts for short queries or when it is not configured', async () => {
    const off = fakeOff()
    expect((await createFoodSearchService({ local: localProvider(), off }).searchPackaged('a')).providerStatus.off).toBe('skipped')
    expect(off.searchPackaged).not.toHaveBeenCalled()
    expect((await createFoodSearchService({ local: localProvider() }).searchPackaged('hummus')).providerStatus.off).toBe('skipped')
  })
})

describe('lookupBarcode', () => {
  it('rejects malformed codes without calling any provider', async () => {
    const off = fakeOff()
    expect(await createFoodSearchService({ local: localProvider(), off }).lookupBarcode('12-ab')).toEqual({ status: 'invalid_code' })
    expect(off.lookupBarcodeDetailed).not.toHaveBeenCalled()
  })

  it('finds the user’s saved product locally first', async () => {
    const saved = testFood('Cornflakes', { id: 'u-corn', source: 'off', barcode: '5000000000001', createdBy: 'u1' })
    const off = fakeOff()
    const result = await createFoodSearchService({ local: localProvider([saved]), off }).lookupBarcode('5000000000001')
    expect(result).toMatchObject({ status: 'found', providerId: 'local', food: { id: 'u-corn' } })
    expect(off.lookupBarcodeDetailed).not.toHaveBeenCalled()
  })

  it('falls back to Open Food Facts with the normalized code and caches the answer', async () => {
    const off = fakeOff()
    const nutella = remoteFood('off', 'Nutella', { barcode: '3017624010701' })
    off.lookupBarcodeDetailed.mockResolvedValue({ status: 'found', food: nutella })
    const service = createFoodSearchService({ local: localProvider(), off })
    expect(await service.lookupBarcode('3017 6240 10701')).toEqual({ status: 'found', food: nutella, providerId: 'off' })
    await service.lookupBarcode('3017624010701')
    expect(off.lookupBarcodeDetailed).toHaveBeenCalledTimes(1)
    expect(off.lookupBarcodeDetailed.mock.calls[0]?.[0]).toBe('3017624010701')
  })

  it.each([
    [{ status: 'not_found' } as const, { status: 'not_found', barcode: '7290000000008' }],
    [{ status: 'incomplete', productName: 'Water' } as const, { status: 'incomplete', barcode: '7290000000008', productName: 'Water' }],
    [{ status: 'invalid_code' } as const, { status: 'invalid_code' }],
  ])('maps the Open Food Facts answer %o', async (answer, expected) => {
    const off = fakeOff()
    off.lookupBarcodeDetailed.mockResolvedValue(answer)
    expect(await createFoodSearchService({ local: localProvider(), off }).lookupBarcode('7290000000008')).toEqual(expected)
  })

  it('reports provider errors and still searches Open Food Facts when local lookup fails', async () => {
    const off = fakeOff()
    off.lookupBarcodeDetailed.mockRejectedValue(new FoodProviderError('off', 'network', 'offline'))
    const local = { search: async () => page('local', []), lookupBarcode: () => Promise.reject(new Error('db')) }
    const result = await createFoodSearchService({ local, off }).lookupBarcode('7290000000008')
    expect(result).toMatchObject({ status: 'error', barcode: '7290000000008', error: { kind: 'network' } })
  })

  it('answers not_found when Open Food Facts is not configured', async () => {
    expect(await createFoodSearchService({ local: localProvider() }).lookupBarcode('7290000000008')).toEqual({
      status: 'not_found',
      barcode: '7290000000008',
    })
  })

  it('times out a stalled lookup and rejects when the caller aborts', async () => {
    const off = fakeOff()
    off.lookupBarcodeDetailed.mockImplementation((_code, signal) => hangUntilAborted(signal))
    const slow = await createFoodSearchService({ local: localProvider(), off, timeoutMs: 20 }).lookupBarcode('7290000000008')
    expect(slow).toMatchObject({ status: 'error', error: { kind: 'timeout' } })
    const controller = new AbortController()
    const pending = createFoodSearchService({ local: localProvider(), off }).lookupBarcode('7290000000008', {
      signal: controller.signal,
    })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('getDetails', () => {
  const usdaResult = remoteFood('usda', 'Cheese, cheddar', { externalId: '173414', servings: [] })

  it('loads the full USDA detail, keeping the identity of the picked food, and caches it', async () => {
    const usda = fakeUsda(async () => page('usda', []))
    const detail = { ...usdaResult, id: 'other', servings: [{ label: '1 cup, diced', grams: 132 }] }
    usda.getFood.mockResolvedValue(detail)
    const service = createFoodSearchService({ local: localProvider(), usda })
    const result = await service.getDetails(usdaResult)
    expect(result.status).toBe('ok')
    expect(result.food).toMatchObject({ id: usdaResult.id, servings: detail.servings })
    await service.getDetails(usdaResult)
    expect(usda.getFood).toHaveBeenCalledTimes(1)
    expect(usda.getFood.mock.calls[0]?.[0]).toBe('173414')
  })

  it('returns the original food when the detail is unknown, fails, or does not apply', async () => {
    const usda = fakeUsda(async () => page('usda', []))
    const service = createFoodSearchService({ local: localProvider(), usda, cache: null })
    expect(await service.getDetails(usdaResult)).toEqual({ food: usdaResult, status: 'ok' })
    usda.getFood.mockRejectedValueOnce(new FoodProviderError('usda', 'timeout', 'slow'))
    expect(await service.getDetails(usdaResult)).toEqual({ food: usdaResult, status: 'timeout' })
    const system = TEST_CATALOG[0]!
    expect(await service.getDetails(system)).toEqual({ food: system, status: 'skipped' })
    usda.setAvailable(false)
    expect((await service.getDetails(usdaResult)).status).toBe('skipped')
  })
})
