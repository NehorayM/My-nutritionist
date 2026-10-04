import { describe, expect, it } from 'vitest'
import { emptyTotals, nutrientProfile } from '../nutrients'
import {
  adultProfile,
  CHEESE_PIZZA,
  COLA,
  dailyTargets,
  localTime,
  mealEntry,
  target,
  TODAY,
} from './__fixtures__/nutrition'
import { aggregateDay, sumNutrientProfiles } from './aggregation'
import { calculateRemaining } from './remaining'
import { nutrientStatus } from './status'
import { calculateDailyTargets } from './targets'

const known = (value: number) => ({ value, knownCount: 1, missingCount: 0 })

describe('nutrientStatus', () => {
  const energy = target('energy', 2000, 1800, 2200)

  it('energy: under / on_track / over relative to min and max', () => {
    expect(nutrientStatus(energy, known(1799))).toBe('under')
    expect(nutrientStatus(energy, known(1800))).toBe('on_track')
    expect(nutrientStatus(energy, known(2200))).toBe('on_track')
    expect(nutrientStatus(energy, known(2201))).toBe('over')
  })

  it('energy without bounds falls back to the amount', () => {
    const point = target('energy', 2000, null, null)
    expect(nutrientStatus(point, known(1999))).toBe('under')
    expect(nutrientStatus(point, known(2000))).toBe('on_track')
    expect(nutrientStatus(point, known(2001))).toBe('over')
  })

  it('goal: met at or above the amount, over only above a set max', () => {
    const protein = target('goal', 100, 50, 175)
    expect(nutrientStatus(protein, known(99.9))).toBe('under')
    expect(nutrientStatus(protein, known(100))).toBe('met')
    expect(nutrientStatus(protein, known(175))).toBe('met')
    expect(nutrientStatus(protein, known(176))).toBe('over')
    expect(nutrientStatus(target('goal', 28, null, null), known(500))).toBe('met')
  })

  it('limit: on_track up to the limit, over above it', () => {
    const sodium = target('limit', 2300, null, 2300)
    expect(nutrientStatus(sodium, known(2300))).toBe('on_track')
    expect(nutrientStatus(sodium, known(2301))).toBe('over')
    expect(nutrientStatus(target('limit', 30, 20, null), known(31))).toBe('over')
  })

  it('tolerates floating-point noise at exact boundaries', () => {
    const sum = sumNutrientProfiles([0.1, 0.2].map((protein) => nutrientProfile({ protein }))).protein
    expect(sum.value).not.toBe(0.3)
    expect(nutrientStatus(target('goal', 0.3, null, 0.3), sum)).toBe('met')
    expect(nutrientStatus(target('limit', 0.3, null, 0.3), sum)).toBe('on_track')
    expect(nutrientStatus(target('energy', 0.3, 0.3, 0.3), sum)).toBe('on_track')
  })

  it('unknown when nothing is known but items lack the value', () => {
    expect(nutrientStatus(energy, { value: 0, knownCount: 0, missingCount: 2 })).toBe('unknown')
  })

  it('with nothing logged: energy and goals are under, limits on track', () => {
    const none = { value: 0, knownCount: 0, missingCount: 0 }
    expect(nutrientStatus(energy, none)).toBe('under')
    expect(nutrientStatus(target('goal', 28, null, null), none)).toBe('under')
    expect(nutrientStatus(target('limit', 2300, null, 2300), none)).toBe('on_track')
  })
})

describe('calculateRemaining', () => {
  const targets = dailyTargets({
    calories: target('energy', 2000, 1800, 2200),
    protein: target('goal', 100, 50, 175),
    fiber: target('goal', 28, null, null),
    sodium: target('limit', 2300, null, 2300),
    vitaminD: target('goal', 15, null, 100),
    iron: target('goal', 18, null, 45),
  })

  it('reports remaining amounts, progress and data completeness per nutrient', () => {
    const totals = sumNutrientProfiles([
      nutrientProfile({ calories: 900, protein: 40, fiber: 10, sodium: 1000, iron: 4, vitaminD: null }),
      nutrientProfile({ calories: 300, protein: 20, fiber: null, sodium: 500, iron: 1, vitaminD: null }),
    ])
    const result = calculateRemaining({ targets, totals, entries: [], now: localTime(13), date: TODAY })
    expect(result.byNutrient.calories).toMatchObject({ remaining: 800, progress: 0.6, status: 'under', dataComplete: true })
    expect(result.byNutrient.protein).toMatchObject({ remaining: 40, progress: 0.6, status: 'under' })
    expect(result.byNutrient.fiber).toMatchObject({ remaining: 18, status: 'under', dataComplete: false })
    expect(result.byNutrient.sodium).toMatchObject({ remaining: 800, status: 'on_track' })
    expect(result.byNutrient.vitaminD).toMatchObject({ remaining: 15, progress: 0, status: 'unknown', dataComplete: false })
    expect(result.byNutrient.carbs).toBeUndefined()
    expect(result.gaps).toEqual(['protein', 'fiber', 'iron'])
    expect(result.surpluses).toEqual([])
  })

  it('a gap needs at least 20 % of the target still to go', () => {
    const totals = { ...emptyTotals(), protein: known(80), fiber: known(22.5), iron: known(14.4) }
    const result = calculateRemaining({ targets, totals, entries: [], now: localTime(13), date: TODAY })
    expect(result.gaps).toEqual(['protein', 'iron', 'vitaminD'])
  })

  it('excludes met, over and unknown nutrients from gaps', () => {
    const totals = { ...emptyTotals(), protein: known(180), fiber: known(30), iron: { value: 0, knownCount: 0, missingCount: 1 } }
    const result = calculateRemaining({ targets, totals, entries: [], now: localTime(13), date: TODAY })
    expect(result.byNutrient.protein?.status).toBe('over')
    expect(result.byNutrient.protein?.remaining).toBe(-80)
    expect(result.gaps).toEqual(['vitaminD'])
    expect(result.surpluses).toEqual([])
  })

  it('progress is 0 when a target amount is 0', () => {
    const zero = dailyTargets({ sodium: target('limit', 0, null, 0) })
    const result = calculateRemaining({ targets: zero, totals: { ...emptyTotals(), sodium: known(10) }, entries: [], now: localTime(9), date: TODAY })
    expect(result.byNutrient.sodium).toMatchObject({ progress: 0, remaining: -10, status: 'over' })
  })

  it('large pizza day → energy surplus, sodium and saturated-fat surpluses, fiber gap', () => {
    const daily = calculateDailyTargets({ profile: adultProfile(), date: TODAY })
    const entries = [
      mealEntry('lunch', CHEESE_PIZZA, 258),
      mealEntry('lunch', COLA, 370),
      mealEntry('dinner', CHEESE_PIZZA, 516),
    ]
    const day = aggregateDay(TODAY, entries)
    const result = calculateRemaining({ targets: daily, totals: day.totals, entries, now: localTime(20, 30), date: TODAY })

    expect(day.totals.calories.value).toBeCloseTo(2214.24, 6)
    expect(result.byNutrient.calories?.status).toBe('over')
    expect(result.surpluses).toEqual(['calories', 'saturatedFat', 'sodium'])
    expect(result.gaps).toContain('fiber')
    expect(result.gaps).toEqual(['fiber', 'potassium', 'vitaminC', 'vitaminD'])
    expect(result.byNutrient.protein?.status).toBe('met')
    expect(result.remainingMeals).toEqual(['snack'])
  })

  it('returns no remaining meals for a past day and every slot for a future day', () => {
    const totals = emptyTotals()
    expect(calculateRemaining({ targets, totals, entries: [], now: localTime(9), date: '2026-10-01' }).remainingMeals).toEqual([])
    expect(calculateRemaining({ targets, totals, entries: [], now: localTime(9), date: '2026-10-06' }).remainingMeals).toHaveLength(4)
  })
})
