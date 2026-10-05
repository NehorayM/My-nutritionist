import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { nutrientProfile } from '@/domain/nutrients'
import { setRepositories } from '@/services/runtime'
import type { FoodPortion } from '@/types'
import { MealsScreen } from './MealsScreen'
import { catalogPortion } from './testing/foodFixtures'
import {
  calorieSummary,
  freshRepositories,
  macroSummary,
  mealCard,
  registerMealsTestHooks,
  renderMeals,
  seedMeal,
} from './testing/mealsHarness'

registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

/** A custom food that only reports energy and the three energy macros (everything else unknown). */
const grandmasCake: FoodPortion = {
  foodId: null,
  foodSource: 'custom',
  foodExternalId: null,
  foodName: 'Grandma’s cake',
  brand: null,
  quantity: 100,
  servingLabel: null,
  servingGrams: null,
  grams: 100,
  per100g: nutrientProfile({ calories: 350, protein: 5, carbs: 50, fat: 15 }),
}

describe('Meals: nutrition summary', () => {
  it('describes calories above the target neutrally', async () => {
    await seedMeal([catalogPortion('cheese_pizza', 4, 1)], 'dinner')
    await seedMeal([catalogPortion('rolled_oats', 1, 1), catalogPortion('banana', 1, 0)], 'breakfast')
    await seedMeal([catalogPortion('hummus', 1, 1)], 'snack')
    await renderMeals()

    expect(calorieSummary()).toBe('1,848 kcal of 2,000 kcal, 152 kcal remaining')
    await seedMeal([catalogPortion('apple', 1, 0), catalogPortion('almonds', 30)], 'snack')
    expect(await screen.findByText(/^Above target by \d+ kcal$/)).toBeInTheDocument()
    expect(calorieSummary()).toMatch(/^2,1\d\d kcal of 2,000 kcal, above target by 1\d\d kcal$/)
    expect(screen.getByText('General wellness targets. Add your details in Profile for personal ones.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\b(bad|cheat|guilt|burn off|earn)\b/i)
  })

  it('shows unknown nutrients as missing data, never as zero', async () => {
    await seedMeal([grandmasCake], 'snack')
    await seedMeal([catalogPortion('banana', 1, 0)], 'breakfast')
    const { user } = await renderMeals()

    expect(macroSummary('Fiber')).toBe('3 g of 28 g')
    expect(screen.getByText('Fiber isn’t reported for some foods, so this total may be higher.')).toBeInTheDocument()

    const snacks = mealCard('Snacks')
    expect(within(snacks).getByRole('button', { name: 'Edit Grandma’s cake' })).toHaveTextContent('— fiber')
    await user.click(within(snacks).getByRole('button', { name: 'Details' }))
    expect(
      within(snacks).getByText(
        'Fiber, sugars, saturated fat, sodium, iron, calcium, vitamin C, vitamin D and potassium aren’t reported for this food.',
      ),
    ).toBeInTheDocument()
    expect(within(snacks).queryByText('Iron')).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: /Micronutrient coverage/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('Some foods don’t report every micronutrient')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('Not reported for some foods')).toHaveLength(5)
    expect(
      screen.getByText(
        '1 of 2 logged foods report all of these nutrients. Amounts that aren’t reported are left out, so totals may be higher.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Iron' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/^0.4 mg of .*, not reported for some foods$/))
  })

  it('invites logging on an empty day and reports complete data once logged', async () => {
    await seedMeal([catalogPortion('apple', 1, 0)], 'snack')
    const { user } = await renderMeals()
    expect(within(mealCard('Breakfast')).getByText('Nothing logged yet')).toBeInTheDocument()
    expect(within(mealCard('Breakfast')).getByRole('button', { name: 'Add food to Breakfast' })).toHaveTextContent('Add food')
    await user.click(screen.getByRole('button', { name: /Micronutrient coverage/ }))
    expect(screen.getByText('Every logged food reports all of these nutrients.')).toBeInTheDocument()
    expect(screen.queryByText('Not reported for some foods')).not.toBeInTheDocument()
  })
})

describe('Meals: loading problems', () => {
  it('shows a calm error with retry when the day cannot be loaded', async () => {
    setRepositories(null)
    render(<MealsScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this day's meals")
    expect(screen.getByRole('alert')).toHaveTextContent('Your data is safe.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Meals' })).toBeInTheDocument()
  })
})
