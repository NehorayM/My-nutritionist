import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  TODAY,
  addFoodSheet,
  calorieSummary,
  freshRepositories,
  macroSummary,
  mealCard,
  registerMealsTestHooks,
  renderMeals,
  storedEntries,
} from './testing/mealsHarness'

registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

async function openFood(user: Awaited<ReturnType<typeof renderMeals>>['user'], meal: string, query: string, name: RegExp) {
  await user.click(within(mealCard(meal as 'Lunch')).getByRole('button', { name: `Add food to ${meal}` }))
  const sheet = addFoodSheet()
  await user.type(within(sheet).getByRole('searchbox', { name: 'Search foods' }), query)
  const results = await within(sheet).findByRole('list', { name: 'Matching foods' })
  await user.click(await within(results).findByRole('button', { name }))
  return sheet
}

describe('Meals: logging a food', () => {
  it('searches, picks a food, changes the grams and logs it to the right meal', async () => {
    const { user } = await renderMeals()
    expect(calorieSummary()).toBe('0 kcal of 2,000 kcal, 2,000 kcal remaining')
    const sheet = await openFood(user, 'Lunch', 'rice', /^White rice, cooked/)

    expect(within(sheet).getByRole('heading', { level: 3, name: 'White rice, cooked' })).toHaveFocus()
    expect(within(sheet).getByRole('combobox', { name: 'Unit' })).toHaveDisplayValue('1 cup (158 g)')
    expect(within(sheet).getByRole('combobox', { name: 'Meal' })).toHaveDisplayValue('Lunch')

    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Unit' }), 'grams')
    const amount = within(sheet).getByRole('textbox', { name: /Amount/ })
    expect(amount).toHaveValue('158')
    await user.clear(amount)
    await user.type(amount, '200')
    expect(within(sheet).getByRole('columnheader', { name: 'In 200 g' })).toBeInTheDocument()
    expect(within(sheet).getByRole('row', { name: /Calories/ })).toHaveTextContent('Calories130 kcal260 kcal')

    await user.click(within(sheet).getByRole('button', { name: 'Add to Lunch' }))
    expect(await screen.findByText('Added to Lunch')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Add food' })).not.toBeInTheDocument()

    const lunch = mealCard('Lunch')
    const row = within(lunch).getByRole('button', { name: 'Edit White rice, cooked' })
    expect(row).toHaveTextContent('White rice, cooked260 kcal200 g')
    expect(within(lunch).getByText('260 kcal · 1 item')).toBeInTheDocument()
    expect(within(mealCard('Breakfast')).getByText('Nothing logged yet')).toBeInTheDocument()
    expect(calorieSummary()).toBe('260 kcal of 2,000 kcal, 1,740 kcal remaining')
    expect(macroSummary('Carbohydrates')).toMatch(/^56 g of/)

    expect(await storedEntries()).toMatchObject([
      { foodName: 'White rice, cooked', mealType: 'lunch', date: TODAY, grams: 200, quantity: 200, servingLabel: null, servingGrams: null },
    ])
  })

  it('logs a serving unit with a decimal quantity (quantity × serving grams)', async () => {
    const { user } = await renderMeals()
    const sheet = await openFood(user, 'Breakfast', 'banana', /^Banana/)

    expect(within(sheet).getByRole('combobox', { name: 'Unit' })).toHaveDisplayValue('1 medium banana (118 g)')
    const amount = within(sheet).getByRole('textbox', { name: /Amount/ })
    await user.clear(amount)
    await user.type(amount, '1,5')
    expect(within(sheet).getByText('= 177 g')).toBeInTheDocument()
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Meal' }), 'Snacks')
    await user.click(within(sheet).getByRole('button', { name: 'Add to Snacks' }))

    expect(await screen.findByText('Added to Snacks')).toBeInTheDocument()
    expect(within(mealCard('Snacks')).getByRole('button', { name: 'Edit Banana' })).toHaveTextContent(
      'Banana158 kcal1.5 × 1 medium banana (177 g)',
    )
    expect(await storedEntries()).toMatchObject([
      { mealType: 'snack', quantity: 1.5, servingLabel: '1 medium banana (118 g)', servingGrams: 118, grams: 177 },
    ])
  })

  it('rejects amounts that are zero, too small or too large, and saves nothing', async () => {
    const { user } = await renderMeals()
    const sheet = await openFood(user, 'Dinner', 'apple', /^Apple/)
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Unit' }), 'grams')
    const amount = within(sheet).getByRole('textbox', { name: /Amount/ })
    const save = within(sheet).getByRole('button', { name: 'Add to Dinner' })

    await user.clear(amount)
    await user.type(amount, '0')
    await user.click(save)
    expect(within(sheet).getByText('Enter an amount greater than 0.')).toBeInTheDocument()
    expect(amount).toHaveAttribute('aria-invalid', 'true')
    expect(amount).toHaveFocus()

    await user.clear(amount)
    await user.type(amount, '6000')
    expect(
      within(sheet).getByText('That’s more than 5,000 g in one entry. Check the amount, or log it as separate entries.'),
    ).toBeInTheDocument()
    await user.click(save)

    await user.clear(amount)
    await user.type(amount, '0.05')
    expect(within(sheet).getByText('That’s too small to log. Enter at least 0.1 g.')).toBeInTheDocument()

    await user.clear(amount)
    await user.click(save)
    expect(within(sheet).getByText('Enter an amount.')).toBeInTheDocument()
    expect(await storedEntries()).toEqual([])
    await user.keyboard('{Escape}')
    expect(within(mealCard('Dinner')).getByText('Nothing logged yet')).toBeInTheDocument()
  })
})
