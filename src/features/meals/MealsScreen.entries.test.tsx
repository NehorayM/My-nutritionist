import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogPortion } from './testing/foodFixtures'
import {
  TODAY,
  YESTERDAY,
  calorieSummary,
  freshRepositories,
  mealCard,
  registerMealsTestHooks,
  renderMeals,
  seedMeal,
  storedEntries,
} from './testing/mealsHarness'

registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

describe('Meals: changing logged food', () => {
  it('edits amount and meal; the snapshot stays and totals update', async () => {
    await seedMeal([catalogPortion('white_rice_cooked', 1, 0)], 'lunch')
    const { user } = await renderMeals()
    expect(calorieSummary()).toBe('205 kcal of 2,000 kcal, 1,795 kcal remaining')

    await user.click(within(mealCard('Lunch')).getByRole('button', { name: 'Edit White rice, cooked' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit entry' })
    const amount = within(sheet).getByRole('textbox', { name: /Amount/ })
    expect(amount).toHaveValue('1')
    await user.clear(amount)
    await user.type(amount, '2')
    expect(within(sheet).getByText('= 316 g')).toBeInTheDocument()
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Meal' }), 'Dinner')
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Entry updated')).toBeInTheDocument()
    expect(within(mealCard('Lunch')).getByText('Nothing logged yet')).toBeInTheDocument()
    expect(within(mealCard('Dinner')).getByRole('button', { name: 'Edit White rice, cooked' })).toHaveTextContent(
      'White rice, cooked411 kcal2 × 1 cup (316 g)',
    )
    expect(calorieSummary()).toBe('411 kcal of 2,000 kcal, 1,589 kcal remaining')
    const [stored] = await storedEntries()
    expect(stored).toMatchObject({ mealType: 'dinner', quantity: 2, grams: 316, servingGrams: 158 })
    expect(stored?.per100g.calories).toBe(130)
  })

  it('deletes an entry with an Undo that restores it', async () => {
    await seedMeal([catalogPortion('apple', 1, 0)], 'snack')
    const { user } = await renderMeals()

    await user.click(within(mealCard('Snacks')).getByRole('button', { name: 'Remove Apple' }))
    expect(await screen.findByText('Removed Apple')).toBeInTheDocument()
    expect(within(mealCard('Snacks')).getByText('Nothing logged yet')).toBeInTheDocument()
    expect(calorieSummary()).toBe('0 kcal of 2,000 kcal, 2,000 kcal remaining')
    expect(await storedEntries()).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await within(mealCard('Snacks')).findByRole('button', { name: 'Edit Apple' })).toBeInTheDocument()
    expect(calorieSummary()).toBe('95 kcal of 2,000 kcal, 1,905 kcal remaining')
    expect(await storedEntries()).toHaveLength(1)
  })

  it('repeats yesterday’s meal into today with one tap', async () => {
    await seedMeal([catalogPortion('greek_yogurt_plain', 1, 0), catalogPortion('blueberries', 75)], 'breakfast', YESTERDAY)
    const { user } = await renderMeals()

    const breakfast = mealCard('Breakfast')
    expect(within(mealCard('Lunch')).queryByRole('button', { name: /Repeat/ })).not.toBeInTheDocument()
    await user.click(await within(breakfast).findByRole('button', { name: 'Repeat yesterday’s breakfast' }))

    expect(await screen.findByText('Repeated yesterday’s breakfast')).toBeInTheDocument()
    expect(within(breakfast).getByRole('button', { name: 'Edit Greek yogurt, plain, low-fat' })).toBeInTheDocument()
    expect(within(breakfast).getByRole('button', { name: 'Edit Blueberries' })).toHaveTextContent('75 g')
    expect((await storedEntries(TODAY)).map((entry) => [entry.foodName, entry.mealType])).toEqual([
      ['Greek yogurt, plain, low-fat', 'breakfast'],
      ['Blueberries', 'breakfast'],
    ])
    expect(await storedEntries(YESTERDAY)).toHaveLength(2)
  })

  it('saves a meal as a template and logs it to another meal', async () => {
    await seedMeal([catalogPortion('greek_yogurt_plain', 1, 0), catalogPortion('blueberries', 1, 0)], 'breakfast')
    const { user } = await renderMeals()

    await user.click(within(mealCard('Breakfast')).getByRole('button', { name: 'Save as meal' }))
    const saveSheet = screen.getByRole('dialog', { name: 'Save as meal' })
    const name = within(saveSheet).getByRole('textbox', { name: /Name/ })
    expect(name).toHaveValue('My breakfast')
    await user.clear(name)
    await user.click(within(saveSheet).getByRole('button', { name: 'Save meal' }))
    expect(within(saveSheet).getByText('Give the meal a name.')).toBeInTheDocument()
    await user.type(name, 'Yogurt bowl')
    await user.click(within(saveSheet).getByRole('button', { name: 'Save meal' }))
    expect(await screen.findByText('Meal saved')).toBeInTheDocument()

    await user.click(within(mealCard('Snacks')).getByRole('button', { name: 'Add food to Snacks' }))
    const sheet = screen.getByRole('dialog', { name: 'Add food' })
    await user.click(within(sheet).getByRole('tab', { name: 'Saved meals' }))
    const template = await within(sheet).findByRole('listitem', { name: 'Yogurt bowl' })
    expect(template).toHaveTextContent('2 foods · 230 kcal')
    await user.click(within(template).getByRole('button', { name: 'Log Yogurt bowl to Snacks' }))

    expect(await screen.findByText('Logged “Yogurt bowl” to Snacks')).toBeInTheDocument()
    const snacks = mealCard('Snacks')
    expect(within(snacks).getByText('230 kcal · 2 items')).toBeInTheDocument()
    expect((await storedEntries()).filter((entry) => entry.mealType === 'snack')).toHaveLength(2)
  })
})

describe('Meals: date navigation', () => {
  it('shows another day’s meals and never moves past today', async () => {
    await seedMeal([catalogPortion('cheese_pizza', 4, 1)], 'dinner', YESTERDAY)
    await seedMeal([catalogPortion('apple', 1, 0)], 'snack', TODAY)
    const { user } = await renderMeals()

    expect(screen.getByText('Wednesday, October 7, 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(await screen.findByText('Tuesday, October 6, 2026')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    const dinner = await within(mealCard('Dinner')).findByRole('button', { name: 'Edit Cheese pizza' })
    expect(dinner).toHaveTextContent('Cheese pizza1,266 kcal4 × 1 slice, large pizza (476 g)')
    expect(within(mealCard('Snacks')).getByText('Nothing logged yet')).toBeInTheDocument()
    expect(calorieSummary()).toBe('1,266 kcal of 2,000 kcal, 734 kcal remaining')
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(await within(mealCard('Snacks')).findByRole('button', { name: 'Edit Apple' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
  })
})
