import { describe, expect, it } from 'vitest'
import { fakeUsda, hangUntilAborted, page, remoteFood } from './__fixtures__/fakeProviders'
import { TEST_CATALOG, testFood } from './__fixtures__/foods'
import { createFoodSearchService } from './foodSearchService'
import { createLocalCatalogProvider } from './providers/localCatalogProvider'
import { FoodProviderError } from './providers/types'
import type { FoodItem } from '@/types'

function localProvider(catalog: readonly FoodItem[] = TEST_CATALOG, userFoods: readonly FoodItem[] = []) {
  return createLocalCatalogProvider({ catalog, getUserFoods: async () => userFoods })
}

const names = (items: FoodItem[]) => items.map((item) => item.name)

describe('food search: providers and merging', () => {
  it('searches only the local catalog for queries shorter than 2 characters', async () => {
    const usda = fakeUsda(async () => page('usda', [remoteFood('usda', 'Cheese, swiss')]))
    const service = createFoodSearchService({ local: localProvider(), usda })
    const result = await service.search('c')
    expect(usda.search).not.toHaveBeenCalled()
    expect(result.providerStatus).toEqual({ local: 'ok', usda: 'skipped', off: 'skipped' })
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('skips USDA when it is unavailable (guest mode)', async () => {
    const usda = fakeUsda(async () => page('usda', []))
    usda.setAvailable(false)
    const result = await createFoodSearchService({ local: localProvider(), usda }).search('hummus')
    expect(usda.search).not.toHaveBeenCalled()
    expect(result.providerStatus.usda).toBe('skipped')
    expect(names(result.items)).toEqual(['Hummus'])
  })

  it('lists local results first and drops remote duplicates by name, barcode and provider record', async () => {
    const saved = testFood('Cheddar, aged', { id: 'u1', source: 'usda', externalId: '173414', createdBy: 'user' })
    const usda = fakeUsda(async () =>
      page('usda', [
        remoteFood('usda', 'Cheese, cheddar', { externalId: '328637' }), // same words as "Cheddar cheese"
        remoteFood('usda', 'Cheddar cheese, sharp', { externalId: '1', barcode: '0041711093004' }),
        remoteFood('usda', 'Cheddar Cheese Sharp', { externalId: '2', barcode: '41711093004' }), // same barcode
        remoteFood('usda', 'Cheese, cheddar (SR)', { externalId: '173414' }), // the user's saved copy
      ], true),
    )
    const service = createFoodSearchService({ local: localProvider(TEST_CATALOG, [saved]), usda })
    const result = await service.search('  cheddar ')
    expect(usda.search).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'cheddar', page: 1, pageSize: 15, scope: 'generic' }),
    )
    // The user's own food is boosted within the local ranking; remote results follow.
    expect(names(result.items)).toEqual(['Cheddar, aged', 'Cheddar cheese', 'Cheddar cheese, sharp'])
    expect(result).toMatchObject({ query: 'cheddar', page: 1, hasMore: true })
    expect(result.providerStatus).toEqual({ local: 'ok', usda: 'ok', off: 'skipped' })
    expect(result.errors).toEqual({})
  })

  it('drops a USDA result linked to a local food under another name', async () => {
    const usda = fakeUsda(async () => page('usda', [remoteFood('usda', 'Chickpeas, mature seeds, cooked', { externalId: '173757' })]))
    const linkedRecordKey = (food: FoodItem) => (food.name === 'Chickpeas, cooked' ? 'usda:173757' : null)
    const service = createFoodSearchService({ local: localProvider(), usda, linkedRecordKey })
    expect(names((await service.search('chickpeas')).items)).toEqual(['Chickpeas, cooked'])
  })

  it('passes the branded scope to USDA', async () => {
    const usda = fakeUsda(async () => page('usda', []))
    await createFoodSearchService({ local: localProvider(), usda }).search('granola', { usdaScope: 'branded' })
    expect(usda.search.mock.calls[0]?.[0].scope).toBe('branded')
  })
})

describe('food search: failures and timeouts', () => {
  it('returns local results with the USDA error when USDA fails', async () => {
    const error = new FoodProviderError('usda', 'rate_limited', 'limit', 60_000)
    const usda = fakeUsda(() => Promise.reject(error))
    const result = await createFoodSearchService({ local: localProvider(), usda }).search('falafel')
    expect(names(result.items)).toEqual(['Falafel'])
    expect(result.providerStatus.usda).toBe('rate_limited')
    expect(result.errors.usda?.retryAfterMs).toBe(60_000)
  })

  it('returns USDA results when the local search fails', async () => {
    const usda = fakeUsda(async () => page('usda', [remoteFood('usda', 'Quinoa, cooked')]))
    const local = { search: () => Promise.reject(new Error('IndexedDB closed')) }
    const result = await createFoodSearchService({ local, usda }).search('quinoa')
    expect(names(result.items)).toEqual(['Quinoa, cooked'])
    expect(result.providerStatus).toMatchObject({ local: 'unavailable', usda: 'ok' })
  })

  it('times out a slow provider, aborting its request, and keeps the other results', async () => {
    let providerSignal: AbortSignal | undefined
    const usda = fakeUsda((request) => {
      providerSignal = request.signal
      return hangUntilAborted(request.signal)
    })
    const result = await createFoodSearchService({ local: localProvider(), usda, timeoutMs: 20 }).search('pita')
    expect(result.providerStatus.usda).toBe('timeout')
    expect(providerSignal?.aborted).toBe(true)
    expect(names(result.items)).toEqual(['Pita bread', 'Shawarma in pita'])
  })

  it('times out a provider that ignores its abort signal', async () => {
    const usda = fakeUsda(() => new Promise(() => undefined))
    const result = await createFoodSearchService({ local: localProvider(), usda, timeoutMs: 20 }).search('pita')
    expect(result.providerStatus.usda).toBe('timeout')
  })

  it('propagates the caller abort to providers and rejects with an AbortError', async () => {
    let providerSignal: AbortSignal | undefined
    const usda = fakeUsda((request) => {
      providerSignal = request.signal
      return hangUntilAborted(request.signal)
    })
    const controller = new AbortController()
    const pending = createFoodSearchService({ local: localProvider(), usda }).search('pita', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(providerSignal?.aborted).toBe(true)
  })

  it('rejects immediately without calling providers when already aborted', async () => {
    const usda = fakeUsda(async () => page('usda', []))
    const controller = new AbortController()
    controller.abort()
    const service = createFoodSearchService({ local: localProvider(), usda })
    await expect(service.search('pita', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(usda.search).not.toHaveBeenCalled()
  })
})

describe('food search: caching and pagination', () => {
  it('serves a repeated remote query from the cache, keyed by normalized query and page', async () => {
    const usda = fakeUsda(async () => page('usda', [remoteFood('usda', 'Lentils, boiled')]))
    const service = createFoodSearchService({ local: localProvider(), usda })
    await service.search('Lentils')
    const again = await service.search(' lentils ')
    expect(usda.search).toHaveBeenCalledTimes(1)
    expect(names(again.items)).toEqual(['Lentils, boiled'])
    await service.search('lentils', { page: 2 })
    expect(usda.search).toHaveBeenCalledTimes(2)
    service.clearCache()
    await service.search('lentils')
    expect(usda.search).toHaveBeenCalledTimes(3)
  })

  it('never caches failures and can run without a cache', async () => {
    let calls = 0
    const usda = fakeUsda(async () => {
      calls += 1
      if (calls === 1) throw new FoodProviderError('usda', 'network', 'offline')
      return page('usda', [])
    })
    const service = createFoodSearchService({ local: localProvider(), usda, cache: null })
    expect((await service.search('lentils')).providerStatus.usda).toBe('network')
    expect((await service.search('lentils')).providerStatus.usda).toBe('ok')
    await service.search('lentils')
    expect(usda.search).toHaveBeenCalledTimes(3)
  })

  it('pages local results by 20 and drops remote duplicates of earlier local pages', async () => {
    const rice = Array.from({ length: 45 }, (_, i) => testFood(`Rice dish ${String(i).padStart(2, '0')}`))
    const usda = fakeUsda(async (request) =>
      page('usda', [remoteFood('usda', 'Rice dish 03'), remoteFood('usda', 'Rice, white, cooked')], request.page < 2, request.page),
    )
    const service = createFoodSearchService({ local: localProvider(rice), usda })
    const second = await service.search('rice', { page: 2 })
    expect(usda.search.mock.calls[0]?.[0]).toMatchObject({ page: 2, pageSize: 15 })
    expect(names(second.items).slice(0, 2)).toEqual(['Rice dish 20', 'Rice dish 21'])
    expect(names(second.items).slice(20)).toEqual(['Rice, white, cooked'])
    expect(second.hasMore).toBe(true) // local page 3 exists
    const third = await service.search('rice', { page: 3 })
    expect(names(third.items).slice(0, 5)).toEqual(['Rice dish 40', 'Rice dish 41', 'Rice dish 42', 'Rice dish 43', 'Rice dish 44'])
    expect(third.hasMore).toBe(false)
  })
})
