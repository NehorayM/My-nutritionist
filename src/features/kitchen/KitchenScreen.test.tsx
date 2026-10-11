import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/Toaster'
import { systemFoodBySlug } from '@/data/systemFoods'
import { FoodServiceContext } from '@/features/meals/services/foodService'
import { freshRepositories, registerMealsTestHooks, storedEntries, testFoodService } from '@/features/meals/testing/mealsHarness'
import { createQueryTranslator } from '@/services/translation'
import { useKitchenStore, type PantryInput } from '@/stores/kitchenStore'
import { getRepositories } from '@/services/runtime'
import { KitchenScreen } from './KitchenScreen'

/** Kitchen tab: inventory + constraints in, meals planned only from them out, and logging a planned meal. */
registerMealsTestHooks()

beforeEach(async () => {
  await freshRepositories()
})

function item(slug: string, grams: number | null, patch: Partial<PantryInput> = {}): PantryInput {
  const food = systemFoodBySlug(slug)
  if (!food) throw new Error(slug)
  return { food, grams, servingLabel: null, servingGrams: null, prep: 'ready', cookMinutes: null, methods: [], useBy: null, ...patch }
}

async function seedKitchen() {
  await useKitchenStore.getState().load()
  for (const entry of [
    item('egg_hard_boiled', 300),
    item('whole_wheat_bread', 400),
    item('greek_yogurt_plain', 500),
    item('banana', 360),
    item('tomato', null),
    item('cucumber', null),
    item('hummus', 250),
    item('white_rice_cooked', 400, { prep: 'reheat', methods: ['microwave'] }),
    item('chicken_breast_roasted', 500, { prep: 'cook', cookMinutes: 25, methods: ['stove'] }),
    item('almonds', 200),
  ]) {
    const result = await useKitchenStore.getState().addItem(entry)
    if (!result.ok) throw new Error(result.message)
  }
}

function renderKitchen() {
  const user = userEvent.setup({ delay: null })
  render(
    <FoodServiceContext value={testFoodService({ translator: createQueryTranslator({ machine: null }) })}>
      <KitchenScreen />
      <Toaster />
    </FoodServiceContext>,
  )
  return user
}

describe('Kitchen screen', () => {
  it('starts with an empty kitchen and explains how plans work', async () => {
    renderKitchen()
    expect(await screen.findByRole('heading', { name: 'Your kitchen is empty' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your plan starts with your kitchen' })).toBeInTheDocument()
  })

  it('adds an item found by a Hebrew search, with how it is eaten', async () => {
    const user = renderKitchen()
    await user.click(await screen.findByRole('button', { name: 'Add your first item' }))
    const sheet = screen.getByRole('dialog', { name: 'Add to your kitchen' })
    await user.type(within(sheet).getByRole('searchbox', { name: 'Find a food' }), 'ביצים')
    await user.click(await within(sheet).findByRole('button', { name: /^Egg, hard-boiled/ }))
    const amount = within(sheet).getByRole('textbox', { name: 'Amount' })
    await user.clear(amount)
    await user.type(amount, '6')
    await user.click(within(sheet).getByRole('radio', { name: 'Ready to eat' }))
    await user.click(within(sheet).getByRole('button', { name: 'Add to kitchen' }))
    const list = await screen.findByRole('list', { name: 'Kitchen items' })
    expect(within(list).getByText('Egg, hard-boiled')).toBeInTheDocument()
    expect(within(list).getByText(/6 × 1 large egg/)).toBeInTheDocument()
    expect(await getRepositories().pantry.list()).toEqual([expect.objectContaining({ grams: 300, prep: 'ready' })])
  })

  it('plans the day from the kitchen and logs a planned meal, taking it out of the kitchen', async () => {
    await seedKitchen()
    const user = renderKitchen()
    const breakfast = await screen.findByRole('article', { name: 'Breakfast plan' })
    expect(screen.getByTestId('day-total')).toHaveTextContent(/kcal planned/)
    const names = within(within(breakfast).getByRole('list', { name: 'Breakfast items' })).getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(names.length).toBeGreaterThan(0)
    const before = useKitchenStore.getState().pantry.reduce((sum, i) => sum + (i.grams ?? 0), 0)
    await user.click(within(breakfast).getByRole('button', { name: 'Log to breakfast' }))
    expect(await screen.findByText('Logged to Breakfast')).toBeInTheDocument()
    await vi.waitFor(async () => expect((await storedEntries('2026-10-07')).every((entry) => entry.mealType === 'breakfast')).toBe(true))
    expect((await storedEntries('2026-10-07')).length).toBe(names.length)
    const after = useKitchenStore.getState().pantry.reduce((sum, i) => sum + (i.grams ?? 0), 0)
    expect(after).toBeLessThan(before)
  })

  it('respects a microwave-only, no-cooking lunch set in Kitchen & time', async () => {
    await seedKitchen()
    const user = renderKitchen()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const sheet = screen.getByRole('dialog', { name: 'Kitchen & time' })
    await user.click(within(sheet).getByRole('radio', { name: 'Per meal' }))
    const lunch = within(sheet).getByRole('group', { name: 'Lunch' })
    for (const tool of ['Stove', 'Oven']) await user.click(within(lunch).getByRole('button', { name: tool }))
    await user.click(within(lunch).getByRole('switch', { name: /I can cook/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    const plan = await screen.findByRole('article', { name: 'Lunch plan' })
    expect(within(plan).queryByText(/Chicken breast/)).not.toBeInTheDocument()
    expect(useKitchenStore.getState().settings?.meals.lunch).toMatchObject({ equipment: ['microwave'], canCook: false })
  })
})
