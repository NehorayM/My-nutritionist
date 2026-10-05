import { describe, expect, it } from 'vitest'
import type { MealEntry, MealType } from '@/types'
import { aggregateDay, calculateRemaining, type DailyTargets, type RemainingNutrition } from '../nutrition'
import { TODAY, entry, food, localTime, profile, targetsFor } from './__fixtures__/adaptive'
import { allocateMeal, allocateMealBudget, dailyEnergyTarget, mealWeight, nextMealSlot } from './allocation'
import { BUDGET_CAP_SHARE, BUDGET_FLOOR_SHARE, LIGHT_MEAL_FACTOR, MAX_MEAL_FACTOR } from './constants'

const targets = targetsFor(profile())
const dailyKcal = targets.targets.calories!.amount
/** 1 kcal per gram, so grams = kcal. */
const mixed = food({ per100g: { calories: 100, protein: 5, carbs: 12, fat: 3.5, fiber: 1 } })

function remainingFor(entries: MealEntry[], now: Date, dayTargets: DailyTargets = targets): RemainingNutrition {
  const { totals } = aggregateDay(TODAY, entries)
  return calculateRemaining({ targets: dayTargets, totals, entries, now, date: TODAY })
}

function macroKcal(budget: Record<string, number | undefined>): number {
  return (budget.protein ?? 0) * 4 + (budget.carbs ?? 0) * 4 + (budget.fat ?? 0) * 9
}

describe('meal slots', () => {
  it('plans the earliest main meal still ahead, then snacks', () => {
    expect(nextMealSlot(['lunch', 'dinner', 'snack'])).toBe('lunch')
    expect(nextMealSlot(['dinner', 'breakfast'])).toBe('breakfast')
    expect(nextMealSlot(['snack'])).toBe('snack')
    expect(nextMealSlot([])).toBeNull()
  })

  it('weighs main meals 1 and snacks 0.35', () => {
    expect((['breakfast', 'lunch', 'dinner'] as MealType[]).map(mealWeight)).toEqual([1, 1, 1])
    expect(mealWeight('snack')).toBe(0.35)
  })

  it('falls back to the 2,000 kcal reference without a usable energy target', () => {
    expect(dailyEnergyTarget(targets)).toBe(dailyKcal)
    expect(dailyEnergyTarget({ ...targets, targets: {} })).toBe(2000)
    expect(dailyEnergyTarget({ ...targets, targets: { calories: { amount: 0, min: null, max: null, kind: 'energy' } } })).toBe(2000)
  })
})

describe('allocateMeal', () => {
  it('gives the next main meal its weighted share of what remains', () => {
    const remaining = remainingFor([], localTime(12, 30))
    const { budget, share, energyState } = allocateMeal(remaining, targets, 'lunch', remaining.remainingMeals)
    expect(remaining.remainingMeals).toEqual(['lunch', 'dinner', 'snack'])
    expect(share).toBeCloseTo(1 / 2.35)
    expect(energyState).toBe('normal')
    expect(budget.calories).toBeCloseTo(dailyKcal / 2.35)
    expect(macroKcal(budget)).toBeCloseTo(budget.calories!)
    expect(budget.fiber).toBeGreaterThan(0)
    expect(budget.iron).toBeGreaterThan(0)
  })

  it('gives a snack a smaller share than a main meal', () => {
    const remaining = remainingFor([], localTime(12, 30))
    const snack = allocateMeal(remaining, targets, 'snack', ['dinner', 'snack'])
    const dinner = allocateMeal(remaining, targets, 'dinner', ['dinner', 'snack'])
    expect(snack.share).toBeCloseTo(0.35 / 1.35)
    expect(snack.budget.calories!).toBeLessThan(dinner.budget.calories!)
  })

  it('includes the target meal in the split even when it is not listed as remaining', () => {
    const remaining = remainingFor([], localTime(12, 30))
    expect(allocateMeal(remaining, targets, 'dinner', []).share).toBe(1)
  })

  it('never plans an oversized catch-up meal', () => {
    const remaining = remainingFor([], localTime(20, 0))
    const regular = dailyKcal / 3.35
    const { budget, share } = allocateMeal(remaining, targets, 'dinner', remaining.remainingMeals)
    expect(share).toBeCloseTo(1 / 1.35)
    expect(budget.calories).toBeCloseTo(regular * MAX_MEAL_FACTOR)
  })

  it('becomes a light-meal allowance with emphasis on protein when energy is in surplus', () => {
    const remaining = remainingFor([entry(mixed, 2600, 'breakfast')], localTime(18, 0))
    expect(remaining.surpluses).toContain('calories')
    const { budget, energyState } = allocateMeal(remaining, targets, 'dinner', remaining.remainingMeals)
    expect(energyState).toBe('surplus')
    expect(budget.calories).toBeCloseTo((dailyKcal / 3.35) * LIGHT_MEAL_FACTOR)
    expect((budget.protein! * 4) / budget.calories!).toBeGreaterThanOrEqual(0.3 - 1e-9)
    for (const value of Object.values(budget)) expect(value).toBeGreaterThanOrEqual(0)
    expect(macroKcal(budget)).toBeCloseTo(budget.calories!)
  })

  it('is a light allowance when little energy is left but the day is not in surplus', () => {
    const remaining = remainingFor([entry(mixed, 1700, 'breakfast')], localTime(12, 30))
    expect(remaining.surpluses).not.toContain('calories')
    const allocation = allocateMeal(remaining, targets, 'lunch', remaining.remainingMeals)
    expect(allocation.energyState).toBe('light')
    expect(allocation.budget.calories).toBeCloseTo((dailyKcal / 3.35) * LIGHT_MEAL_FACTOR)
  })

  it('keeps regular-sized meals (no light allowance) when asked, e.g. for under-18s', () => {
    const remaining = remainingFor([entry(mixed, 2600, 'breakfast')], localTime(12, 30))
    const allocation = allocateMeal(remaining, targets, 'lunch', remaining.remainingMeals, { regularMeals: true })
    expect(allocation.energyState).toBe('normal')
    expect(allocation.budget.calories).toBeCloseTo(dailyKcal / 3.35)
  })

  it('keeps nutrients between half and twice the meal’s proportional share', () => {
    const fiberRich = food({ per100g: { calories: 100, protein: 5, carbs: 12, fat: 3.5, fiber: 20 } })
    const met = remainingFor([entry(fiberRich, 400, 'breakfast')], localTime(12, 30))
    const metBudget = allocateMealBudget(met, targets, 'lunch', met.remainingMeals)
    const fiberTarget = targets.targets.fiber!.amount
    expect(metBudget.fiber).toBeCloseTo((BUDGET_FLOOR_SHARE * fiberTarget * metBudget.calories!) / dailyKcal)

    const late = remainingFor([], localTime(22, 15))
    const snack = allocateMealBudget(late, targets, 'snack', late.remainingMeals)
    expect(late.remainingMeals).toEqual(['snack'])
    expect(snack.fiber).toBeCloseTo((BUDGET_CAP_SHARE * fiberTarget * snack.calories!) / dailyKcal)
  })

  it('returns the same budget through allocateMealBudget', () => {
    const remaining = remainingFor([], localTime(8, 0))
    expect(allocateMealBudget(remaining, targets, 'breakfast', remaining.remainingMeals)).toEqual(
      allocateMeal(remaining, targets, 'breakfast', remaining.remainingMeals).budget,
    )
  })

  it('only budgets nutrients that have a target', () => {
    const energyOnly: DailyTargets = { ...targets, targets: { calories: targets.targets.calories! } }
    const remaining = remainingFor([], localTime(12, 30), energyOnly)
    expect(Object.keys(allocateMealBudget(remaining, energyOnly, 'lunch', remaining.remainingMeals))).toEqual(['calories'])
  })

  it('caps protein at half the meal energy and splits the rest when carbohydrate or fat has no target', () => {
    const { calories, protein, carbs } = targets.targets
    const noFat: DailyTargets = { ...targets, targets: { calories: calories!, protein: { ...protein!, amount: 400 }, carbs: carbs! } }
    const remaining = remainingFor([], localTime(12, 30), noFat)
    const budget = allocateMealBudget(remaining, noFat, 'lunch', remaining.remainingMeals)
    expect(budget.protein! * 4).toBeCloseTo(budget.calories! / 2)
    expect(budget.carbs! * 4).toBeCloseTo((budget.calories! / 2) * 0.55)
    expect(budget.fat).toBeUndefined()

    const proteinOnly: DailyTargets = { ...targets, targets: { calories: calories!, protein: protein! } }
    const onlyProtein = allocateMealBudget(remainingFor([], localTime(12, 30), proteinOnly), proteinOnly, 'lunch', ['lunch'])
    expect(Object.keys(onlyProtein).sort()).toEqual(['calories', 'protein'])
  })

  it('splits non-protein energy 55/45 when carbohydrate and fat budgets are both zero', () => {
    const { calories, protein, carbs, fat } = targets.targets
    const zero: DailyTargets = {
      ...targets,
      targets: { calories: calories!, protein: protein!, carbs: { ...carbs!, amount: 0 }, fat: { ...fat!, amount: 0 } },
    }
    const budget = allocateMealBudget(remainingFor([], localTime(12, 30), zero), zero, 'lunch', ['lunch'])
    const rest = budget.calories! - budget.protein! * 4
    expect(budget.carbs! * 4).toBeCloseTo(rest * 0.55)
    expect(budget.fat! * 9).toBeCloseTo(rest * 0.45)
  })

  it('falls back to the daily targets when the remaining summary lacks a nutrient', () => {
    const empty: RemainingNutrition = { byNutrient: {}, remainingMeals: ['lunch', 'dinner', 'snack'], gaps: [], surpluses: [] }
    const { budget, energyState } = allocateMeal(empty, targets, 'lunch', empty.remainingMeals)
    expect(energyState).toBe('normal')
    expect(budget.calories).toBeCloseTo(dailyKcal / 2.35)
    expect(budget.fiber).toBeCloseTo(targets.targets.fiber!.amount / 2.35)
    expect(budget.iron).toBeCloseTo(targets.targets.iron!.amount / 2.35)
  })
})
