import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import type { KitchenEquipment, MealType, PantryItem, PlannerSettings } from '@/types'
import { planMeals } from './engine'
import { equipmentFor, mealBlock, mealEquipment, mealMinutes } from './feasibility'
import type { PlannerInput, PlannerResult } from './types'
import { CALORIES, cooked, kitchen, leftovers, pantry, settings, TODAY } from './__fixtures__/pantry'

const plan = (overrides: Partial<PlannerInput> = {}): PlannerResult =>
  planMeals({ pantry: kitchen(), settings: settings(), calories: CALORIES, profile: null, today: TODAY, ...overrides })

const mealOf = (result: PlannerResult, meal: MealType) => result.meals.find((m) => m.mealType === meal)

/**
 * The planner's promise, checked on every option and day plan it returns: only pantry items, never more than is
 * at home, only what the meal's equipment / cooking / time allow, and calories within the meal's range.
 * Returns the broken rules (empty when the plan is valid).
 */
function violations(result: PlannerResult, input: Pick<PlannerInput, 'pantry' | 'settings'>): string[] {
  const found: string[] = []
  const fail = (rule: string) => found.push(rule)
  const byId = new Map(input.pantry.map((item) => [item.id, item]))
  for (const meal of result.meals) {
    const constraint = input.settings.meals[meal.mealType]
    const equipment = mealEquipment(input.settings, meal.mealType)
    if (!constraint.enabled && meal.options.length > 0) fail(`${meal.mealType}: planned although turned off`)
    for (const option of meal.options) {
      const items: PantryItem[] = []
      for (const planned of option.items) {
        const item = byId.get(planned.pantryItemId)
        if (!item) {
          fail(`${meal.mealType}: item not in the pantry`)
          continue
        }
        items.push(item)
        if (mealBlock(item, constraint, equipment) !== null) fail(`${meal.mealType}: ${item.food.name} not possible (${String(mealBlock(item, constraint, equipment))})`)
        if (item.grams !== null && planned.grams > item.grams + 1e-6) fail(`${item.food.name}: ${planned.grams} g planned, ${item.grams} g at home`)
        if (planned.grams <= 0) fail(`${item.food.name}: empty portion`)
        if (planned.equipment !== equipmentFor(item, equipment)) fail(`${item.food.name}: wrong equipment`)
      }
      if (option.totals.kcal < meal.range.min || option.totals.kcal > meal.range.max) fail(`${meal.mealType}: ${option.totals.kcal} kcal outside ${meal.range.min}–${meal.range.max}`)
      if (option.prepMinutes !== mealMinutes(items)) fail(`${meal.mealType}: preparation time misreported`)
      if (option.prepMinutes > constraint.maxMinutes) fail(`${meal.mealType}: ${option.prepMinutes} min > ${constraint.maxMinutes} min`)
    }
  }
  for (const [id, used] of Object.entries(result.dayPlan?.usage ?? {})) {
    const stock = byId.get(id)?.grams
    if (stock !== null && stock !== undefined && used > stock + 1e-6) fail(`day uses ${used} g of ${stock} g`)
  }
  const day = result.dayPlan
  if (day?.fits && (day.totals.kcal < result.day.min || day.totals.kcal > result.day.max)) fail(`day of ${day.totals.kcal} kcal claimed to fit`)
  return found
}

function expectStrict(result: PlannerResult, input: Pick<PlannerInput, 'pantry' | 'settings'>): void {
  expect(violations(result, input)).toEqual([])
}

describe('meal planning from the pantry', () => {
  it('plans a full day within the daily range from a typical kitchen', () => {
    const input = { pantry: kitchen(), settings: settings() }
    const result = plan(input)
    expectStrict(result, input)
    expect(result.dayPlan?.fits).toBe(true)
    for (const meal of result.meals) expect(meal.options.length).toBeGreaterThan(0)
  })

  it('uses only a microwave at a work lunch: never cooks raw chicken there', () => {
    const work = settings({ lunch: { canCook: false, maxMinutes: 10, equipment: ['microwave'] } }, { equipmentScope: 'meal' })
    const input = { pantry: kitchen(), settings: work }
    const result = plan(input)
    expectStrict(result, input)
    const lunchItems = mealOf(result, 'lunch')?.options.flatMap((option) => option.items) ?? []
    expect(lunchItems.length).toBeGreaterThan(0)
    expect(lunchItems.some((item) => item.food.name.startsWith('Chicken'))).toBe(false)
    expect(lunchItems.filter((item) => item.prep !== 'ready').every((item) => item.equipment === 'microwave')).toBe(true)
  })

  it('offers only ready-to-eat food when a meal has no equipment and no cooking', () => {
    const noCook = settings({ breakfast: { canCook: false, maxMinutes: 0, equipment: [] } }, { equipmentScope: 'meal' })
    const input = { pantry: kitchen(), settings: noCook }
    const result = plan(input)
    expectStrict(result, input)
    const breakfast = mealOf(result, 'breakfast')?.options ?? []
    expect(breakfast.length).toBeGreaterThan(0)
    expect(breakfast.every((option) => option.items.every((item) => item.prep === 'ready') && option.prepMinutes === 0)).toBe(true)
  })

  it('keeps each meal in its own calorie limits', () => {
    const tight = settings({ lunch: { kcalMin: 400, kcalMax: 450 }, snack: { kcalMin: 100, kcalMax: 150 } })
    const input = { pantry: kitchen(), settings: tight }
    const result = plan(input)
    expectStrict(result, input)
    expect(mealOf(result, 'lunch')?.options.every((o) => o.totals.kcal >= 400 && o.totals.kcal <= 450)).toBe(true)
  })

  it('never uses more of an item than is at home across the day', () => {
    const scarce = [pantry('egg_hard_boiled', { grams: 100 }), pantry('whole_wheat_bread', { grams: 120 }), pantry('tomato', { grams: 200 }), pantry('cottage_cheese', { grams: 250 })]
    const input = { pantry: scarce, settings: settings() }
    const result = plan(input)
    expectStrict(result, input)
    const eggs = scarce[0]?.id ?? ''
    expect(result.dayPlan?.usage[eggs] ?? 0).toBeLessThanOrEqual(100)
  })

  it('explains meals it cannot plan, and does not claim a full day', () => {
    const veg = [pantry('cucumber'), pantry('tomato')]
    const result = plan({ pantry: veg })
    expect(mealOf(result, 'dinner')).toMatchObject({ options: [], gap: 'calories_out_of_reach' })
    expect(result.dayPlan?.fits ?? false).toBe(false)
    const empty = plan({ pantry: [] })
    expect(empty.meals.every((meal) => meal.gap === 'nothing_available')).toBe(true)
    expect(empty.dayPlan).toBeNull()
    const rawOnly = plan({ pantry: [cooked('chicken_breast_roasted', 25)], settings: settings({ lunch: { canCook: false } }) })
    expect(mealOf(rawOnly, 'lunch')?.gap).toBe('no_cooking')
    const slow = plan({ pantry: [cooked('lentils_cooked', 40)], settings: settings({ lunch: { maxMinutes: 15 } }) })
    expect(mealOf(slow, 'lunch')?.gap).toBe('not_enough_time')
    const disabled = plan({ settings: settings({ snack: { enabled: false } }) })
    expect(mealOf(disabled, 'snack')).toMatchObject({ options: [], gap: 'disabled' })
  })

  it('sets aside items it may never use, with the reason', () => {
    const result = plan({ pantry: [...kitchen(), pantry('potato_chips'), pantry('banana', { useBy: '2026-10-01' })] })
    expect(result.excluded.map((item) => item.reason).sort()).toEqual(['expired', 'occasional'])
  })

  it('prefers food that has to be used soon', () => {
    const soon = leftovers('white_rice_cooked', { grams: 400, useBy: '2026-10-13' })
    const result = plan({ pantry: [...kitchen().filter((item) => !item.food.name.startsWith('White rice')), soon] })
    const used = Object.keys(result.dayPlan?.usage ?? {})
    expect(used).toContain(soon.id)
  })

  it('is deterministic, and other variants are still valid plans', () => {
    const items = kitchen()
    const input = { pantry: items, settings: settings() }
    expect(planMeals({ ...input, calories: CALORIES, profile: null, today: TODAY })).toEqual(planMeals({ ...input, calories: CALORIES, profile: null, today: TODAY }))
    const ids = new Set<string>()
    for (let variant = 0; variant < 4; variant += 1) {
      const result = planMeals({ ...input, calories: CALORIES, profile: null, today: TODAY, variant })
      expectStrict(result, input)
      ids.add(result.meals.map((meal) => meal.options[0]?.id ?? '').join('/'))
    }
    expect(ids.size).toBeGreaterThan(1)
  })

  it('plans a large pantry quickly', () => {
    const big = SYSTEM_FOODS.slice(0, 45).map((food) => pantry(food.externalId ?? '', { food, grams: 500 }))
    const started = performance.now()
    const result = plan({ pantry: big })
    expect(performance.now() - started).toBeLessThan(1500)
    expectStrict(result, { pantry: big, settings: settings() })
  })
})

/** Small seeded PRNG (mulberry32) for reproducible random scenarios. */
function random(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('strictness on random kitchens (property test)', () => {
  const tools: KitchenEquipment[] = ['microwave', 'stove', 'oven']
  it('every option and day plan respects pantry and constraints in 150 random scenarios', () => {
    const broken: string[] = []
    for (let seed = 1; seed <= 150; seed += 1) {
      const next = random(seed)
      const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)] as T
      const items: PantryItem[] = Array.from({ length: 3 + Math.floor(next() * 10) }, () => {
        const food = pick(SYSTEM_FOODS)
        const prep = pick(['ready', 'ready', 'reheat', 'cook'] as const)
        const methods = prep === 'ready' ? [] : tools.filter(() => next() < 0.6).concat(prep === 'cook' ? ['stove'] : ['microwave']).filter((t, i, all) => all.indexOf(t) === i)
        return pantry(food.externalId ?? '', {
          food,
          prep,
          methods: tools.filter((tool) => methods.includes(tool)),
          cookMinutes: prep === 'cook' ? 5 + Math.floor(next() * 50) : null,
          grams: next() < 0.3 ? null : 30 + Math.floor(next() * 600),
          useBy: next() < 0.2 ? `2026-10-${String(10 + Math.floor(next() * 8)).padStart(2, '0')}` : null,
        })
      })
      const meal = () => ({
        enabled: next() < 0.9,
        equipment: tools.filter(() => next() < 0.5),
        canCook: next() < 0.6,
        maxMinutes: Math.floor(next() * 60),
        kcalMin: next() < 0.3 ? 150 + Math.floor(next() * 300) : null,
        kcalMax: null,
      })
      const config: PlannerSettings = settings(
        { breakfast: meal(), lunch: meal(), dinner: meal(), snack: meal() },
        { equipmentScope: next() < 0.5 ? 'day' : 'meal', dayEquipment: tools.filter(() => next() < 0.6) },
      )
      for (const m of Object.values(config.meals)) if (m.kcalMin !== null) m.kcalMax = m.kcalMin + 100 + Math.floor(next() * 300)
      const result = planMeals({ pantry: items, settings: config, calories: { amount: 1500 + Math.floor(next() * 1500), min: null, max: null }, profile: null, today: TODAY, variant: Math.floor(next() * 3) })
      broken.push(...violations(result, { pantry: items, settings: config }).map((rule) => `seed ${seed}: ${rule}`))
    }
    expect(broken).toEqual([])
  })
})
