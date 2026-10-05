import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { FoodProviderError, type FoodProviderErrorKind } from '@/services/food'
import { fakeOff, fakeUsda, providerFood } from './testing/foodFixtures'
import {
  addFoodSheet,
  freshRepositories,
  headerAddFood,
  registerMealsTestHooks,
  renderMeals,
  testFoodService,
} from './testing/mealsHarness'

registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

async function openSearch(service = testFoodService()) {
  const { user } = await renderMeals(service)
  await user.click(headerAddFood())
  const sheet = addFoodSheet()
  return { user, sheet, search: within(sheet).getByRole('searchbox', { name: 'Search foods' }) }
}

describe('Meals: food search', () => {
  it.each<[FoodProviderErrorKind, string]>([
    ['network', 'USDA search couldn’t be reached. Check your connection; foods on this device still work.'],
    ['timeout', 'USDA search took too long to answer. Try again in a moment.'],
    ['rate_limited', 'USDA search is busy right now. Try again in 30 s.'],
    ['unavailable', 'USDA search isn’t available right now.'],
  ])('shows the USDA "%s" status next to local results', async (kind, message) => {
    const usda = fakeUsda([], new FoodProviderError('usda', kind, 'test failure', kind === 'rate_limited' ? 30_000 : null))
    const { user, sheet, search } = await openSearch(testFoodService({ usda }))
    await user.type(search, 'pizza')

    expect(await within(sheet).findByText(message)).toBeInTheDocument()
    const results = within(sheet).getByRole('list', { name: 'Matching foods' })
    expect(within(results).getByRole('button', { name: /^Cheese pizza/ })).toHaveTextContent('266 kcal / 100 gCatalog')
  })

  it('lists USDA results after local ones, with source badges and "Load more"', async () => {
    const page1 = await providerFood({ source: 'usda', externalId: '1001', name: 'Pizza, pepperoni', per100g: { calories: 290 } })
    const page2 = await providerFood({ source: 'usda', externalId: '1002', name: 'Pizza, veggie', per100g: { calories: 240 } })
    const usda = fakeUsda([[page1], [page2]])
    const { user, sheet, search } = await openSearch(testFoodService({ usda }))
    await user.type(search, 'pizza')

    const results = await within(sheet).findByRole('list', { name: 'Matching foods' })
    expect(await within(results).findByRole('button', { name: /^Pizza, pepperoni/ })).toHaveTextContent('290 kcal / 100 gUSDA')
    const names = within(results).getAllByRole('button').map((button) => button.textContent ?? '')
    expect(names[0]).toMatch(/^Cheese pizza/)
    expect(usda.search).toHaveBeenCalledTimes(1)
    expect(usda.search).toHaveBeenCalledWith(expect.objectContaining({ text: 'pizza', page: 1 }))

    await user.click(within(sheet).getByRole('button', { name: 'Load more' }))
    expect(await within(results).findByRole('button', { name: /^Pizza, veggie/ })).toBeInTheDocument()
    expect(within(results).getByRole('button', { name: /^Pizza, pepperoni/ })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('searches packaged products only when asked, and explains the rate limit', async () => {
    const off = fakeOff({
      searchPackaged: async () => {
        throw new FoodProviderError('off', 'rate_limited', 'Too many searches', 45_000)
      },
    })
    const { searchPackaged } = off
    const { user, sheet, search } = await openSearch(testFoodService({ off }))
    await user.type(search, 'hummus')
    await within(sheet).findByRole('button', { name: /^Hummus/ })
    expect(searchPackaged).not.toHaveBeenCalled()

    await user.click(within(sheet).getByRole('button', { name: 'Search packaged products' }))
    expect(
      await within(sheet).findByText('Packaged product search allows about 10 searches a minute. Try again in 45 s.'),
    ).toBeInTheDocument()
    expect(searchPackaged).toHaveBeenCalledTimes(1)
    expect(within(sheet).getByRole('button', { name: /^Hummus/ })).toBeInTheDocument()
  })

  it('shows packaged products from Open Food Facts with their attribution', async () => {
    const bar = await providerFood({
      source: 'off',
      externalId: '7290000000001',
      name: 'Chickpea crisps',
      brand: 'Crunchy Co',
      per100g: { calories: 450, protein: 14, carbs: 60, fat: 16 },
      servings: [{ label: '1 bag (30 g)', grams: 30 }],
    })
    const off = fakeOff({ searchPackaged: async () => ({ providerId: 'off', items: [bar], page: 1, hasMore: false }) })
    const { user, sheet, search } = await openSearch(testFoodService({ off }))
    await user.type(search, 'crisps')
    await user.click(await within(sheet).findByRole('button', { name: 'Search packaged products' }))
    const products = await within(sheet).findByRole('list', { name: 'Packaged products found' })
    const row = within(products).getByRole('button', { name: /^Chickpea crisps/ })
    expect(row).toHaveTextContent('Crunchy Co')
    expect(row).toHaveTextContent('Open Food Facts')

    await user.click(row)
    expect(within(sheet).getByRole('link', { name: 'Open Food Facts (ODbL)' })).toHaveAttribute('href', 'https://world.openfoodfacts.org')
    expect(within(sheet).getByRole('combobox', { name: 'Unit' })).toHaveDisplayValue('1 bag (30 g)')
    expect(within(sheet).getByRole('row', { name: /Calories/ })).toHaveTextContent('Calories450 kcal135 kcal')
  })

  it('looks up a typed barcode and explains when nothing is found', async () => {
    const off = fakeOff()
    const { lookupBarcodeDetailed } = off
    const { user, sheet } = await openSearch(testFoodService({ off }))
    const barcode = within(sheet).getByRole('textbox', { name: 'Barcode' })

    await user.type(barcode, '12ab')
    await user.click(within(sheet).getByRole('button', { name: 'Look up' }))
    expect(within(sheet).getByText('Enter the 6–14 digits printed under the barcode.')).toBeInTheDocument()
    expect(lookupBarcodeDetailed).not.toHaveBeenCalled()

    await user.clear(barcode)
    await user.type(barcode, '7290 0000 00001')
    await user.click(within(sheet).getByRole('button', { name: 'Look up' }))
    expect(await within(sheet).findByText(/No product found for 7290000000001/)).toBeInTheDocument()
  })

  it('says when nothing matches and offers to create a food', async () => {
    const { user, sheet, search } = await openSearch()
    await user.type(search, 'zzqx')
    expect(await within(sheet).findByRole('heading', { name: 'No matches for “zzqx”' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Create custom food' }))
    expect(within(sheet).getByRole('tab', { name: 'Custom', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Create a custom food' })).toBeVisible()
  })
})
