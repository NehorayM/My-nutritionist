import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { userFoodId } from '@/lib/id'
import { getRepositories } from '@/services/runtime'
import { catalogPortion, fakeUsda, providerFood } from './testing/foodFixtures'
import {
  YESTERDAY,
  addFoodSheet,
  freshRepositories,
  headerAddFood,
  mealCard,
  registerMealsTestHooks,
  renderMeals,
  seedMeal,
  storedEntries,
  testFoodService,
} from './testing/mealsHarness'

registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

describe('Meals: custom foods', () => {
  it('creates a food from per-serving label values (stored per 100 g) and logs it', async () => {
    const { user } = await renderMeals()
    await user.click(headerAddFood())
    const sheet = addFoodSheet()
    expect(within(sheet).getByRole('combobox', { name: 'Add to' })).toHaveDisplayValue('Lunch')
    await user.click(within(sheet).getByRole('tab', { name: 'Custom' }))
    const form = within(sheet).getByRole('form', { name: 'Create a custom food' })

    await user.click(within(form).getByRole('button', { name: 'Create food' }))
    expect(within(form).getByText('Enter a name.')).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: /^Name/ })).toHaveFocus()
    expect(within(form).getAllByText('Enter a value (0 if there is none).')).toHaveLength(4)

    await user.type(within(form).getByRole('textbox', { name: /^Name/ }), 'Oat bar')
    await user.type(within(form).getByRole('textbox', { name: 'Serving name' }), '1 bar')
    await user.type(within(form).getByRole('textbox', { name: /Serving size/ }), '40')
    await user.click(within(form).getByRole('radio', { name: 'Per serving' }))
    expect(within(form).getByRole('heading', { name: 'Nutrition per serving (40 g)' })).toBeInTheDocument()
    await user.type(within(form).getByRole('textbox', { name: /Calories/ }), '160')
    await user.type(within(form).getByRole('textbox', { name: /Protein/ }), '4')
    await user.type(within(form).getByRole('textbox', { name: /Carbohydrates/ }), '24')
    await user.type(within(form).getByRole('textbox', { name: /^Fat/ }), '5')
    expect(within(form).getByText(/Saved per 100 g: 400 kcal · 10 g protein · 60 g carbs · 13 g fat/)).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Vegetarian' }))
    await user.click(within(form).getByRole('button', { name: 'Milk' }))
    await user.click(within(form).getByRole('button', { name: 'Create food' }))

    expect(await screen.findByText('Food created')).toBeInTheDocument()
    const [food] = await getRepositories().foods.list()
    expect(food).toMatchObject({ name: 'Oat bar', source: 'custom', servings: [{ label: '1 bar', grams: 40 }], allergens: ['milk'] })
    expect(food?.per100g).toMatchObject({ calories: 400, protein: 10, carbs: 60, fat: 12.5, fiber: null, iron: null })
    expect(food?.dietFlags).toEqual({ vegetarian: true, vegan: null })

    // The new food opens in the detail view, ready to log one serving.
    expect(within(sheet).getByRole('heading', { level: 3, name: 'Oat bar' })).toHaveFocus()
    expect(within(sheet).getByRole('combobox', { name: 'Unit' })).toHaveDisplayValue('1 bar (40 g)')
    await user.click(within(sheet).getByRole('button', { name: 'Add to Lunch' }))
    expect(await screen.findByText('Added to Lunch')).toBeInTheDocument()
    expect(within(mealCard('Lunch')).getByRole('button', { name: 'Edit Oat bar' })).toHaveTextContent('Oat bar160 kcal1 bar (40 g)')
    expect(await storedEntries()).toMatchObject([{ foodId: food?.id, foodSource: 'custom', grams: 40 }])
  })

  it('edits a custom food; logged entries keep their snapshot', async () => {
    const { user } = await renderMeals()
    await user.click(headerAddFood())
    const sheet = addFoodSheet()
    await user.click(within(sheet).getByRole('tab', { name: 'Custom' }))
    const form = within(sheet).getByRole('form', { name: 'Create a custom food' })
    await user.type(within(form).getByRole('textbox', { name: /^Name/ }), 'Soup')
    for (const [label, value] of [[/Calories/, '50'], [/Protein/, '2'], [/Carbohydrates/, '8'], [/^Fat/, '1']] as const) {
      await user.type(within(form).getByRole('textbox', { name: label }), value)
    }
    await user.click(within(form).getByRole('button', { name: 'Create food' }))
    await user.click(await within(sheet).findByRole('button', { name: 'Add to Lunch' }))
    await screen.findByText('Added to Lunch')

    await user.click(headerAddFood())
    const again = addFoodSheet()
    await user.click(within(again).getByRole('tab', { name: 'Custom' }))
    await user.click(await within(again).findByRole('button', { name: 'Edit Soup' }))
    const edit = within(again).getByRole('form', { name: 'Edit Soup' })
    const calories = within(edit).getByRole('textbox', { name: /Calories/ })
    await user.clear(calories)
    await user.type(calories, '80')
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Food updated')).toBeInTheDocument()
    expect((await getRepositories().foods.list())[0]?.per100g.calories).toBe(80)
    expect((await storedEntries())[0]?.per100g.calories).toBe(50)
  })
})

describe('Meals: favorites and recent foods', () => {
  it('favorites a catalog food and an unsaved USDA result (saved to My foods first)', async () => {
    const soup = await providerFood({ source: 'usda', externalId: '2345', name: 'Lentil soup', per100g: { calories: 60, protein: 4, carbs: 9, fat: 1 } })
    const { user } = await renderMeals(testFoodService({ usda: fakeUsda([[soup]]) }))
    await user.click(headerAddFood())
    const sheet = addFoodSheet()
    const search = within(sheet).getByRole('searchbox', { name: 'Search foods' })

    await user.type(search, 'oats')
    await user.click(await within(sheet).findByRole('button', { name: /^Rolled oats \(dry\)/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Favorite', pressed: false }))
    expect(await within(sheet).findByRole('button', { name: 'Favorite', pressed: true })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Back' }))

    await user.clear(search)
    await user.type(search, 'lentil')
    const usdaRow = await within(sheet).findByRole('button', { name: /^Lentil soup/ })
    expect(usdaRow).toHaveTextContent('USDA')
    await user.click(usdaRow)
    await user.click(within(sheet).getByRole('button', { name: 'Favorite', pressed: false }))
    expect(await within(sheet).findByRole('button', { name: 'Favorite', pressed: true })).toBeInTheDocument()

    const { userId } = getRepositories()
    const savedId = await userFoodId(userId, 'usda', '2345')
    expect((await getRepositories().foods.list()).map((food) => [food.id, food.source, food.createdBy])).toEqual([[savedId, 'usda', userId]])
    const favoriteIds = (await getRepositories().favorites.list()).map((favorite) => favorite.foodId).sort()
    expect(favoriteIds).toEqual([savedId, systemFoodBySlug('rolled_oats')?.id].sort())

    await user.click(within(sheet).getByRole('button', { name: 'Back' }))
    await user.click(within(sheet).getByRole('tab', { name: 'Favorites' }))
    const favorites = within(sheet).getByRole('list', { name: 'Favorite foods' })
    const names = within(favorites).getAllByRole('button').map((button) => button.textContent ?? '')
    expect(names).toHaveLength(2)
    expect(names.some((name) => name.startsWith('Lentil soup'))).toBe(true)
    expect(names.some((name) => name.startsWith('Rolled oats (dry)'))).toBe(true)
  })

  it('re-logs a recent food with its last amount in one tap', async () => {
    await seedMeal([catalogPortion('hummus', 2, 0)], 'snack', YESTERDAY)
    const { user } = await renderMeals()
    await user.click(within(mealCard('Snacks')).getByRole('button', { name: 'Add food to Snacks' }))
    const sheet = addFoodSheet()
    await user.click(within(sheet).getByRole('tab', { name: 'Recent' }))

    const recent = await within(sheet).findByRole('list', { name: 'Recent foods' })
    expect(within(recent).getByRole('button', { name: /^Hummus/ })).toHaveTextContent('2 × 1 tbsp (30 g) · 73 kcal')
    await user.click(within(recent).getByRole('button', { name: 'Add Hummus again' }))
    expect(await screen.findByText('Added to Snacks')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(within(mealCard('Snacks')).getByRole('button', { name: 'Edit Hummus' })).toHaveTextContent('2 × 1 tbsp (30 g)')
    expect(await storedEntries()).toMatchObject([{ foodName: 'Hummus', quantity: 2, grams: 30, mealType: 'snack' }])
  })
})
