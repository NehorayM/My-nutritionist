import { describe, expect, it } from 'vitest'
import { SYSTEM_FOOD_RECORDS } from '@/data/catalog'
import type { SystemFoodRecord } from '@/data/catalogSchema'

/** General Atwater check: |kcal − (4·protein + 4·carbs + 9·fat)| ≤ max(10 % of kcal, 5 kcal). */
const RELATIVE_TOLERANCE = 0.1
const ABSOLUTE_TOLERANCE_KCAL = 5
/** Whitelisted foods must match USDA's own food-specific factors this closely. */
const SPECIFIC_FACTOR_TOLERANCE = 0.03

interface SpecificFactors {
  reason: string
  protein: number
  fat: number
  carbs: number
}

const FRUIT: SpecificFactors = {
  reason: 'USDA computes fruit energy with fruit-specific Atwater factors (3.36 / 8.37 / 3.60 kcal/g)',
  protein: 3.36,
  fat: 8.37,
  carbs: 3.6,
}
const VEGETABLE: SpecificFactors = {
  reason: 'USDA computes vegetable energy with vegetable-specific Atwater factors (2.44 / 8.37 / 3.57 kcal/g)',
  protein: 2.44,
  fat: 8.37,
  carbs: 3.57,
}

/**
 * Foods outside the general 4/4/9 tolerance, each with the reason (SR Legacy food_calorie_conversion_factor).
 * The test below proves every reason by recomputing energy with those factors.
 */
const ENERGY_WHITELIST: Readonly<Record<string, SpecificFactors>> = {
  apple: FRUIT,
  banana: FRUIT,
  blueberries: FRUIT,
  medjool_dates: FRUIT,
  spinach_raw: VEGETABLE,
  broccoli_cooked: VEGETABLE,
}

function macros(food: SystemFoodRecord): { kcal: number; protein: number; carbs: number; fat: number } {
  const { calories, protein, carbs, fat } = food.per100g
  if (calories === null || protein === null || carbs === null || fat === null) {
    throw new Error(`${food.slug} lacks energy or macros`)
  }
  return { kcal: calories, protein, carbs, fat }
}

function withinGeneralTolerance(food: SystemFoodRecord): boolean {
  const { kcal, protein, carbs, fat } = macros(food)
  const estimate = 4 * protein + 4 * carbs + 9 * fat
  return Math.abs(kcal - estimate) <= Math.max(RELATIVE_TOLERANCE * kcal, ABSOLUTE_TOLERANCE_KCAL)
}

describe('system food catalog — energy plausibility (4/4/9)', () => {
  it('matches 4·protein + 4·carbs + 9·fat within tolerance, or is whitelisted with a reason', () => {
    const unexplained = SYSTEM_FOOD_RECORDS.filter(
      (food) => !withinGeneralTolerance(food) && ENERGY_WHITELIST[food.slug] === undefined,
    ).map((food) => food.slug)
    expect(unexplained).toEqual([])
  })

  it('keeps the whitelist minimal: every entry exists and really falls outside the general tolerance', () => {
    const stale = Object.keys(ENERGY_WHITELIST).filter((slug) => {
      const food = SYSTEM_FOOD_RECORDS.find((record) => record.slug === slug)
      return food === undefined || withinGeneralTolerance(food)
    })
    expect(stale).toEqual([])
  })

  it('proves each whitelist reason with USDA food-specific Atwater factors', () => {
    const unproven = Object.entries(ENERGY_WHITELIST).filter(([slug, factors]) => {
      const food = SYSTEM_FOOD_RECORDS.find((record) => record.slug === slug)
      if (!food || factors.reason.length === 0) return true
      const { kcal, protein, carbs, fat } = macros(food)
      const estimate = factors.protein * protein + factors.carbs * carbs + factors.fat * fat
      return Math.abs(kcal - estimate) / kcal > SPECIFIC_FACTOR_TOLERANCE
    })
    expect(unproven.map(([slug]) => slug)).toEqual([])
  })

  it('flags an implausible energy value that is not whitelisted', () => {
    const tomato = SYSTEM_FOOD_RECORDS.find((record) => record.slug === 'tomato')
    if (!tomato) throw new Error('missing tomato')
    expect(withinGeneralTolerance(tomato)).toBe(true)
    expect(withinGeneralTolerance({ ...tomato, per100g: { ...tomato.per100g, calories: 180 } })).toBe(false)
  })
})
