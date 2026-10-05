import { describe, expect, it, vi } from 'vitest'
import { fakeUsda, page, remoteFood } from './__fixtures__/fakeProviders'
import { TEST_CATALOG } from './__fixtures__/foods'
import { createFoodSearchService } from './foodSearchService'
import { createLocalCatalogProvider } from './providers/localCatalogProvider'
import type { FoodSearchResult } from './searchTypes'

const local = () => createLocalCatalogProvider({ catalog: TEST_CATALOG, getUserFoods: async () => [] })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('food search: partial results', () => {
  it('reports local results while USDA is still answering, then resolves with everything', async () => {
    const gate = deferred<void>()
    const usda = fakeUsda(async () => {
      await gate.promise
      return page('usda', [remoteFood('usda', 'Hummus, commercial')])
    })
    const partials: FoodSearchResult[] = []
    const search = createFoodSearchService({ local: local(), usda }).search('hummus', { onPartial: (r) => partials.push(r) })

    await vi.waitFor(() => expect(partials).toHaveLength(1))
    expect(partials[0]!.providerStatus).toEqual({ local: 'ok', usda: 'pending', off: 'skipped' })
    expect(partials[0]!.items.map((f) => f.name)).toEqual(['Hummus'])

    gate.resolve()
    const final = await search
    expect(final.providerStatus.usda).toBe('ok')
    expect(final.items.map((f) => f.name)).toEqual(['Hummus', 'Hummus, commercial'])
    expect(partials).toHaveLength(1)
  })

  it('does not report partial results when no remote provider is queried', async () => {
    const usda = fakeUsda(async () => page('usda', []))
    usda.setAvailable(false)
    const onPartial = vi.fn<(partial: FoodSearchResult) => void>()
    await createFoodSearchService({ local: local(), usda }).search('hummus', { onPartial })
    await createFoodSearchService({ local: local(), usda: null }).search('hummus', { onPartial })
    expect(onPartial).not.toHaveBeenCalled()
  })

  it('does not report partial results after the search was aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const onPartial = vi.fn<(partial: FoodSearchResult) => void>()
    const usda = fakeUsda(async () => page('usda', []))
    await expect(
      createFoodSearchService({ local: local(), usda }).search('hummus', { onPartial, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(onPartial).not.toHaveBeenCalled()
  })
})
