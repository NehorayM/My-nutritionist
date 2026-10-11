import { systemFoodBySlug } from '@/data/systemFoods'
import type { MealConstraint, MealType, PantryItem, PlannerSettings } from '@/types'
import { createDefaultPlannerSettings } from '../defaults'

export const USER = '0b6f6c1e-8d3a-4f2b-9c1d-2e3f4a5b6c7d'
export const TODAY = '2026-10-12'
export const TS = '2026-10-12T08:00:00.000Z'
export const CALORIES = { amount: 2000, min: 1800, max: 2200 }

let counter = 0

/** A pantry item of a catalog food (ready to eat unless overridden). */
export function pantry(slug: string, overrides: Partial<PantryItem> = {}): PantryItem {
  const food = systemFoodBySlug(slug)
  if (!food) throw new Error(`No catalog food ${slug}`)
  counter += 1
  return {
    id: `00000000-0000-4000-9000-${String(counter).padStart(12, '0')}`,
    userId: USER,
    food,
    grams: null,
    servingLabel: null,
    servingGrams: null,
    prep: 'ready',
    cookMinutes: null,
    methods: [],
    useBy: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export const cooked = (slug: string, minutes: number, overrides: Partial<PantryItem> = {}) =>
  pantry(slug, { prep: 'cook', cookMinutes: minutes, methods: ['stove', 'oven'], ...overrides })
export const leftovers = (slug: string, overrides: Partial<PantryItem> = {}) =>
  pantry(slug, { prep: 'reheat', methods: ['microwave', 'stove'], ...overrides })

export function settings(meals: Partial<Record<MealType, Partial<MealConstraint>>> = {}, overrides: Partial<PlannerSettings> = {}): PlannerSettings {
  const base = createDefaultPlannerSettings(USER, TS)
  const merged = { ...base.meals }
  for (const [meal, patch] of Object.entries(meals) as [MealType, Partial<MealConstraint>][]) merged[meal] = { ...merged[meal], ...patch }
  return { ...base, meals: merged, ...overrides }
}

/** A typical home kitchen (amounts unknown unless set). */
export function kitchen(): PantryItem[] {
  return [
    pantry('egg_hard_boiled', { grams: 300 }),
    pantry('greek_yogurt_plain', { grams: 500 }),
    pantry('whole_wheat_bread', { grams: 400 }),
    pantry('banana', { grams: 360 }),
    pantry('apple'),
    pantry('tomato'),
    pantry('cucumber'),
    pantry('hummus', { grams: 250 }),
    pantry('cottage_cheese', { grams: 250 }),
    leftovers('white_rice_cooked', { grams: 400 }),
    cooked('chicken_breast_roasted', 25, { grams: 500 }),
    cooked('lentils_cooked', 25),
    pantry('almonds', { grams: 200 }),
    pantry('olive_oil'),
  ]
}
