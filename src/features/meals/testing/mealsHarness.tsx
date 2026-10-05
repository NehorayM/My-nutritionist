import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { Toaster } from '@/components/ui'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import { deleteDatabase } from '@/lib/idb'
import { newId } from '@/lib/id'
import { notify } from '@/lib/notify'
import { createLocalRepositories } from '@/repositories'
import type { Repositories } from '@/repositories/types'
import {
  createFoodSearchService,
  createLocalCatalogProvider,
  type FoodSearchService,
  type FoodSearchServiceOptions,
} from '@/services/food'
import { getRepositories, setRepositories } from '@/services/runtime'
import { useMealsStore } from '@/stores/mealsStore'
import { resetUserStores } from '@/stores/registry'
import { resetUiStore } from '@/stores/uiStore'
import type { FoodPortion, MealEntry, MealType } from '@/types'
import { MealsScreen } from '../MealsScreen'
import { FoodServiceContext } from '../services/foodService'

/** Wednesday 2026-10-07, 12:30 local (lunch time). */
export const TODAY = '2026-10-07'
export const YESTERDAY = '2026-10-06'

const POINTER_CAPTURE = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const

/** Per-file hooks: jsdom pointer-capture stubs (Radix/sonner), toast + clock + repository cleanup. */
export function registerMealsTestHooks(): void {
  const missing = POINTER_CAPTURE.filter((name) => !(name in Element.prototype))
  beforeAll(() => {
    for (const name of missing) {
      Object.defineProperty(Element.prototype, name, { value: () => false, configurable: true, writable: true })
    }
  })
  afterAll(() => {
    for (const name of missing) Reflect.deleteProperty(Element.prototype, name)
  })
  afterEach(() => {
    act(() => notify.dismiss())
    setRepositories(null)
    vi.useRealTimers()
  })
}

/** Fixes the clock at TODAY 12:30 and installs fresh, empty local repositories (stores reset). */
export async function freshRepositories(): Promise<Repositories> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 12, 30))
  await deleteDatabase()
  const repositories = createLocalRepositories(newId())
  setRepositories(repositories)
  resetUserStores()
  resetUiStore()
  return repositories
}

/** A food search service over the bundled catalog + the user's foods, with optional fake remote providers. */
export function testFoodService(remote: Omit<FoodSearchServiceOptions, 'local'> = {}): FoodSearchService {
  return createFoodSearchService({
    local: createLocalCatalogProvider({ catalog: SYSTEM_FOODS, getUserFoods: () => getRepositories().foods.list() }),
    cache: null,
    ...remote,
  })
}

/** Logs portions through the store, as the app does, before the screen opens. */
export async function seedMeal(portions: FoodPortion[], mealType: MealType, date = TODAY): Promise<MealEntry[]> {
  const result = await useMealsStore.getState().addPortions(portions, mealType, date)
  if (!result.ok) throw new Error(result.message)
  return result.value
}

export async function storedEntries(date = TODAY): Promise<MealEntry[]> {
  return getRepositories().meals.listByDate(date)
}

/** Renders the Meals screen (with a test food service) and waits until the day has loaded. */
export async function renderMeals(service: FoodSearchService = testFoodService()) {
  const user = userEvent.setup()
  render(
    <FoodServiceContext value={service}>
      <MealsScreen />
      <Toaster />
    </FoodServiceContext>,
  )
  await screen.findByRole('region', { name: 'Breakfast' })
  return { user }
}

export function mealCard(name: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'): HTMLElement {
  return screen.getByRole('region', { name })
}

/** The screen header's "Add food" action. */
export function headerAddFood(): HTMLElement {
  return within(screen.getByRole('banner')).getByRole('button', { name: 'Add food' })
}

export function addFoodSheet(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Add food' })
}

/** Accessible value text of the calorie ring ("640 kcal of 2,000 kcal, 1,360 kcal remaining"). */
export function calorieSummary(): string {
  return screen.getByRole('progressbar', { name: 'Calories' }).getAttribute('aria-valuetext') ?? ''
}

export function macroSummary(name: 'Protein' | 'Carbohydrates' | 'Fat' | 'Fiber'): string {
  return within(screen.getByRole('list', { name: 'Macronutrients' })).getByRole('progressbar', { name }).getAttribute('aria-valuetext') ?? ''
}
