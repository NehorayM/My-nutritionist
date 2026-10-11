import { within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryTranslator } from '@/services/translation'
import { fakeUsda, providerFood } from './testing/foodFixtures'
import { addFoodSheet, freshRepositories, headerAddFood, registerMealsTestHooks, renderMeals, storedEntries, testFoodService } from './testing/mealsHarness'

/** Typing in Hebrew: RTL input, an English query for the databases, and logging works as usual. */
registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

async function openSearch(service = testFoodService({ translator: createQueryTranslator({ machine: null }) })) {
  const { user } = await renderMeals(service)
  await user.click(headerAddFood())
  const sheet = addFoodSheet()
  return { user, sheet, search: within(sheet).getByRole('searchbox', { name: 'Search foods' }) }
}

describe('Meals: searching in Hebrew', () => {
  it('lets Hebrew be typed right-to-left and searches in English', async () => {
    const usda = fakeUsda([[await providerFood({ source: 'usda', externalId: '171477', name: 'Chicken, breast, roasted', per100g: { calories: 165 } })]])
    const { user, sheet, search } = await openSearch(testFoodService({ usda, translator: createQueryTranslator({ machine: null }) }))
    expect(search).toHaveAttribute('dir', 'auto')
    await user.type(search, 'חזה עוף')

    const note = await within(sheet).findByTestId('translation-note')
    expect(note).toHaveTextContent('Searching in English for “chicken breast” · translated from Hebrew')
    expect(usda.search).toHaveBeenCalledWith(expect.objectContaining({ text: 'chicken breast' }))
    const results = within(sheet).getByRole('list', { name: 'Matching foods' })
    expect(within(results).getAllByRole('button')[0]).toHaveTextContent(/^Chicken breast, roasted/)
    expect(await within(results).findByRole('button', { name: /^Chicken, breast, roasted/ })).toBeInTheDocument()
  })

  it('logs a food found by its Hebrew name', async () => {
    const { user, sheet, search } = await openSearch()
    await user.type(search, 'עגבניות')
    const results = await within(sheet).findByRole('list', { name: 'Matching foods' })
    await user.click(within(results).getByRole('button', { name: /^Tomato/ }))
    await user.click(within(addFoodSheet()).getByRole('button', { name: /^Add to/ }))
    await vi.waitFor(async () => expect((await storedEntries()).map((entry) => entry.foodName)).toEqual(['Tomato']))
  })

  it('says which words could not be translated', async () => {
    const { user, sheet, search } = await openSearch()
    await user.type(search, 'אורז פסיפלורה')
    const note = await within(sheet).findByTestId('translation-note')
    expect(note).toHaveTextContent('Searching in English for “rice”')
    expect(note).toHaveTextContent('Not translated: פסיפלורה')
  })
})
