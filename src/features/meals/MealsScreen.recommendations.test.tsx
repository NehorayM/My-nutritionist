import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import { useFoodLibraryStore } from '@/stores/foodLibraryStore'
import { useProfileStore } from '@/stores/profileStore'
import type { Profile } from '@/types'
import { catalogPortion } from './testing/foodFixtures'
import { freshRepositories, mealCard, registerMealsTestHooks, renderMeals, seedMeal } from './testing/mealsHarness'

registerMealsTestHooks()

const PUNITIVE = /burn|earn|cheat|bad food|guilt|compensat|ruin|punish|failure/i

async function withProfile(changes: Partial<Profile>): Promise<void> {
  await useProfileStore.getState().load()
  const result = await useProfileStore.getState().save({ ...useProfileStore.getState().profile!, ...changes })
  if (!result.ok) throw new Error(result.message)
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Smart options for the rest of today' })
}

async function suggestions(): Promise<HTMLElement[]> {
  const list = await within(section()).findByRole('list', { name: 'Suggested meals' })
  return within(list).getAllByRole('article')
}

function catalogFood(name: string) {
  const food = SYSTEM_FOODS.find((item) => item.name === name)
  if (!food) throw new Error(`Not a catalog food: ${name}`)
  return food
}

beforeEach(async () => {
  await freshRepositories()
  await withProfile({ birthDate: '1990-04-12', sex: 'female', heightCm: 165, currentWeightKg: 62 })
})

describe('Smart options for the rest of today', () => {
  it('suggests the next meal and recalculates after one is logged', async () => {
    await seedMeal([catalogPortion('rolled_oats', 60), catalogPortion('banana', 120)], 'breakfast')
    const { user } = await renderMeals()
    const [first] = await suggestions()
    const title = within(first!).getByRole('heading', { level: 3 }).textContent ?? ''
    await user.click(within(first!).getByRole('button', { name: 'Log to Lunch' }))

    expect(await screen.findByText(`Added ${title} to Lunch`)).toBeInTheDocument()
    expect(within(mealCard('Lunch')).queryByText('Nothing logged yet')).not.toBeInTheDocument()
    // Lunch is covered now, so the engine plans the next meal from the updated intake.
    const after = await suggestions()
    expect(within(after[0]!).getByRole('button', { name: /^Log to (Dinner|Snacks)$/ })).toBeInTheDocument()
  })

  it('answers a large pizza lunch with lighter options and neutral wording', async () => {
    await seedMeal([catalogPortion('rolled_oats', 60)], 'breakfast')
    await seedMeal([catalogPortion('cheese_pizza', 4, 1)], 'lunch')
    await renderMeals()
    const cards = await suggestions()
    expect(cards.length).toBeGreaterThan(0)
    expect(section().textContent).not.toMatch(PUNITIVE)
    for (const card of cards) expect(within(card).getByRole('button', { name: /^Log to / })).toBeInTheDocument()
  })

  it('hides a dismissed suggestion and brings it back with Undo', async () => {
    const { user } = await renderMeals()
    const [first] = await suggestions()
    const title = within(first!).getByRole('heading', { level: 3 }).textContent ?? ''
    await user.click(within(first!).getByRole('button', { name: `Dismiss ${title}` }))
    expect(within(section()).queryByRole('heading', { level: 3, name: title })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(await within(section()).findByRole('heading', { level: 3, name: title })).toBeInTheDocument()
  })

  it('saves a suggestion as a meal template', async () => {
    const { user } = await renderMeals()
    const [first] = await suggestions()
    const title = within(first!).getByRole('heading', { level: 3 }).textContent ?? ''
    await user.click(within(first!).getByRole('button', { name: `Save ${title} to my meals` }))
    expect(await screen.findByText(`Saved “${title}” to your meals`)).toBeInTheDocument()
    expect(useFoodLibraryStore.getState().savedMeals.map((meal) => meal.name)).toContain(title)
  })

  it('only suggests foods compatible with a vegetarian, milk-free profile', async () => {
    await withProfile({ dietType: 'vegetarian', allergies: ['milk'] })
    await renderMeals()
    const cards = await suggestions()
    const names = cards.flatMap((card) => within(card).getAllByRole('listitem').map((item) => item.querySelector('[title]')?.getAttribute('title') ?? ''))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names.filter(Boolean)) {
      const food = catalogFood(name)
      expect(food.dietFlags.vegetarian).toBe(true)
      expect(food.allergens).not.toBeNull()
      expect(food.allergens).not.toContain('milk')
    }
  })

  it('explains when preferences leave nothing to suggest', async () => {
    const everything = ['protein', 'dairy', 'grain', 'legume', 'vegetable', 'fruit', 'fat', 'nut_seed', 'snack', 'sweet', 'fast_food', 'israeli', 'beverage', 'prepared']
    await withProfile({ dislikes: everything })
    await renderMeals()
    expect(await within(section()).findByText('No suggestions match your preferences')).toBeInTheDocument()
    expect(within(section()).getByRole('button', { name: 'Review food preferences' })).toBeInTheDocument()
  })

  it('shows no suggestions for a past day', async () => {
    const { user } = await renderMeals()
    await suggestions()
    await user.click(screen.getByRole('button', { name: /previous day/i }))
    await screen.findByText('Tuesday, October 6, 2026')
    expect(screen.queryByRole('region', { name: 'Smart options for the rest of today' })).not.toBeInTheDocument()
  })
})
