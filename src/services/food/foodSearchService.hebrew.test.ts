import { describe, expect, it, vi } from 'vitest'
import { createQueryTranslator, type MachineTranslator } from '@/services/translation'
import type { FoodItem } from '@/types'
import { fakeOff, fakeUsda, page, remoteFood } from './__fixtures__/fakeProviders'
import { TEST_CATALOG, testFood } from './__fixtures__/foods'
import { createFoodSearchService } from './foodSearchService'
import { createLocalCatalogProvider } from './providers/localCatalogProvider'

/** Hebrew queries are put into English before they reach the databases (requirement: translation layer). */
function setup(userFoods: readonly FoodItem[] = [], machine: MachineTranslator | null = null) {
  const usda = fakeUsda(async (request) => page('usda', [remoteFood('usda', `USDA ${request.text}`)]))
  const off = fakeOff()
  const service = createFoodSearchService({
    local: createLocalCatalogProvider({ catalog: TEST_CATALOG, getUserFoods: async () => userFoods }),
    usda,
    off,
    translator: createQueryTranslator({ machine, isOnline: () => true }),
  })
  return { service, usda, off }
}

const names = (items: FoodItem[]) => items.map((item) => item.name)

describe('food search with Hebrew queries', () => {
  it('sends USDA the English translation and finds catalog foods by it', async () => {
    const { service, usda } = setup()
    const result = await service.search('חזה עוף')
    expect(usda.search).toHaveBeenCalledWith(expect.objectContaining({ text: 'chicken breast' }))
    expect(names(result.items)[0]).toBe('Chicken breast, roasted (skinless)')
    expect(names(result.items)).toContain('USDA chicken breast')
    expect(result.translation).toEqual({ original: 'חזה עוף', query: 'chicken breast', source: 'dictionary', unknown: [] })
  })

  it('still finds the user’s own foods by their Hebrew name', async () => {
    const own = testFood('שניצל של סבתא', { id: 'own-1', source: 'custom', createdBy: 'u1' })
    const { service } = setup([own])
    const result = await service.search('שניצל')
    expect(names(result.items)).toContain('שניצל של סבתא')
    expect(result.translation?.query).toBe('schnitzel')
  })

  it('shows local results at once while the machine translation is pending, then searches USDA in English', async () => {
    let finish: (value: string | null) => void = () => undefined
    const machine: MachineTranslator = { translate: () => new Promise((resolve) => (finish = resolve)) }
    const { service, usda } = setup([], machine)
    const partials: string[] = []
    const pending = service.search('חומוס עם פסיפלורה', { onPartial: (partial) => partials.push(partial.providerStatus.usda) })
    await vi.waitFor(() => expect(partials).toEqual(['pending']))
    expect(usda.search).not.toHaveBeenCalled()
    finish('hummus with passion fruit')
    const result = await pending
    expect(usda.search).toHaveBeenCalledWith(expect.objectContaining({ text: 'hummus with passion fruit' }))
    expect(result.translation).toMatchObject({ source: 'machine' })
  })

  it('never sends Hebrew to USDA: words nobody could translate skip the remote search', async () => {
    const machine: MachineTranslator = { translate: async () => null }
    const { service, usda } = setup([], machine)
    const result = await service.search('פסיפלורה')
    expect(usda.search).not.toHaveBeenCalled()
    expect(result.providerStatus.usda).toBe('skipped')
    expect(result.translation).toMatchObject({ source: 'partial', unknown: ['פסיפלורה'] })
  })

  it('translates the packaged-product search too', async () => {
    const { service, off } = setup()
    const result = await service.searchPackaged('שוקולד מריר')
    expect(off.searchPackaged).toHaveBeenCalledWith(expect.objectContaining({ text: 'dark chocolate' }))
    expect(result.translation?.query).toBe('dark chocolate')
  })

  it('leaves English queries untouched', async () => {
    const { service, usda } = setup()
    const result = await service.search('hummus')
    expect(usda.search).toHaveBeenCalledWith(expect.objectContaining({ text: 'hummus' }))
    expect(result.translation).toBeNull()
  })
})
