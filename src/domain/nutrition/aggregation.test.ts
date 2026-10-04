import { describe, expect, it } from 'vitest'
import { MEAL_TYPES } from '@/types'
import { emptyTotals, nutrientProfile } from '../nutrients'
import { BANANA, CHEESE_PIZZA, COLA, mealEntry, TODAY } from './__fixtures__/nutrition'
import { aggregateDay, sumNutrientProfiles, totalsForPortions, totalsToProfile } from './aggregation'

describe('sumNutrientProfiles', () => {
  it('returns empty totals for no profiles', () => {
    expect(sumNutrientProfiles([])).toEqual(emptyTotals())
  })

  it('sums calories and macros of known values', () => {
    const totals = sumNutrientProfiles([
      nutrientProfile({ calories: 200, protein: 10, carbs: 30, fat: 5 }),
      nutrientProfile({ calories: 350.5, protein: 25, carbs: 12, fat: 18 }),
    ])
    expect(totals.calories).toEqual({ value: 550.5, knownCount: 2, missingCount: 0 })
    expect(totals.protein).toEqual({ value: 35, knownCount: 2, missingCount: 0 })
    expect(totals.carbs.value).toBe(42)
    expect(totals.fat.value).toBe(23)
  })

  it('never treats unknown values as zero: they are counted as missing', () => {
    const totals = sumNutrientProfiles([
      nutrientProfile({ calories: 100, vitaminD: 2 }),
      nutrientProfile({ calories: 50, vitaminD: null }),
      nutrientProfile({ calories: null }),
    ])
    expect(totals.calories).toEqual({ value: 150, knownCount: 2, missingCount: 1 })
    expect(totals.vitaminD).toEqual({ value: 2, knownCount: 1, missingCount: 2 })
    expect(totals.iron).toEqual({ value: 0, knownCount: 0, missingCount: 3 })
  })

  it('counts a known zero as known', () => {
    const totals = sumNutrientProfiles([nutrientProfile({ fiber: 0 })])
    expect(totals.fiber).toEqual({ value: 0, knownCount: 1, missingCount: 0 })
  })

  it('treats corrupt values (NaN, negative) as missing', () => {
    const totals = sumNutrientProfiles([nutrientProfile({ sodium: Number.NaN }), nutrientProfile({ sodium: -4 })])
    expect(totals.sodium).toEqual({ value: 0, knownCount: 0, missingCount: 2 })
  })
})

describe('totalsForPortions', () => {
  it('aggregates micronutrients across scaled portions', () => {
    const totals = totalsForPortions([
      { per100g: CHEESE_PIZZA, grams: 200 },
      { per100g: BANANA, grams: 100 },
    ])
    expect(totals.iron.value).toBeCloseTo(5.26, 10)
    expect(totals.calcium.value).toBeCloseTo(381, 10)
    expect(totals.potassium.value).toBeCloseTo(702, 10)
    expect(totals.vitaminC.value).toBeCloseTo(11.5, 10)
    expect(totals.vitaminD).toEqual({ value: 0, knownCount: 1, missingCount: 1 })
  })
})

describe('aggregateDay', () => {
  const entries = [
    mealEntry('breakfast', BANANA, 120),
    mealEntry('lunch', CHEESE_PIZZA, 172),
    mealEntry('lunch', COLA, 370),
    mealEntry('dinner', CHEESE_PIZZA, 258),
    mealEntry('snack', BANANA, 50, '2026-10-03'),
  ]

  it('totals the day and each meal slot', () => {
    const day = aggregateDay(TODAY, entries)
    expect(day.date).toBe(TODAY)
    expect(day.entryCount).toBe(4)
    expect(day.totals.calories.value).toBeCloseTo(106.8 + 457.52 + 155.4 + 686.28, 8)
    expect(day.byMeal.breakfast.calories.value).toBeCloseTo(106.8, 10)
    expect(day.byMeal.lunch.calories.value).toBeCloseTo(612.92, 8)
    expect(day.byMeal.lunch.calories.knownCount).toBe(2)
    expect(day.byMeal.dinner.sodium.value).toBeCloseTo(1393.2, 8)
  })

  it('includes every meal slot, with empty totals for slots without entries', () => {
    const day = aggregateDay(TODAY, entries)
    expect(Object.keys(day.byMeal)).toEqual([...MEAL_TYPES])
    expect(day.byMeal.snack).toEqual(emptyTotals())
  })

  it('ignores entries from other dates', () => {
    const day = aggregateDay('2026-10-03', entries)
    expect(day.entryCount).toBe(1)
    expect(day.byMeal.snack.calories.value).toBeCloseTo(44.5, 10)
    expect(day.byMeal.lunch).toEqual(emptyTotals())
  })

  it('keeps per-meal data availability for unknown nutrients', () => {
    const day = aggregateDay(TODAY, entries)
    expect(day.byMeal.breakfast.vitaminD).toEqual({ value: 0, knownCount: 0, missingCount: 1 })
    expect(day.totals.vitaminD).toEqual({ value: 0, knownCount: 3, missingCount: 1 })
  })

  it('returns empty totals for a day without entries', () => {
    const day = aggregateDay(TODAY, [])
    expect(day.entryCount).toBe(0)
    expect(day.totals).toEqual(emptyTotals())
  })
})

describe('totalsToProfile', () => {
  it('keeps known sums and turns fully unknown nutrients into null', () => {
    const profile = totalsToProfile(
      sumNutrientProfiles([nutrientProfile({ calories: 100, vitaminD: null }), nutrientProfile({ calories: 20 })]),
    )
    expect(profile.calories).toBe(120)
    expect(profile.vitaminD).toBeNull()
  })

  it('reports a known zero as 0 and nothing logged as null', () => {
    expect(totalsToProfile(sumNutrientProfiles([nutrientProfile({ fiber: 0 })])).fiber).toBe(0)
    expect(totalsToProfile(emptyTotals()).fiber).toBeNull()
  })
})
