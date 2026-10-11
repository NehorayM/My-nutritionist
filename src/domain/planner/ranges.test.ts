import { describe, expect, it } from 'vitest'
import { dailyRange, mealRanges } from './ranges'
import { CALORIES, settings } from './__fixtures__/pantry'

describe('calorie ranges', () => {
  it('uses the targets’ comfortable range by default, or the target ±10 %', () => {
    expect(dailyRange(settings(), CALORIES)).toEqual({ min: 1800, max: 2200, target: 2000 })
    expect(dailyRange(settings(), { amount: 1500, min: null, max: null })).toEqual({ min: 1350, max: 1650, target: 1500 })
  })

  it('respects the user’s limits, including one-sided ones that never cross', () => {
    expect(dailyRange(settings({}, { dailyKcalMin: 1500, dailyKcalMax: 1700 }), CALORIES)).toEqual({ min: 1500, max: 1700, target: 1600 })
    expect(dailyRange(settings({}, { dailyKcalMin: 2400, dailyKcalMax: null }), CALORIES)).toMatchObject({ min: 2400, max: 2400 })
    expect(dailyRange(settings({}, { dailyKcalMin: null, dailyKcalMax: 1600 }), CALORIES)).toMatchObject({ min: 1600, max: 1600 })
  })

  it('splits the day over the planned meals (shares renormalized) with ±15 % per meal', () => {
    const day = dailyRange(settings(), CALORIES)
    const all = mealRanges(settings(), ['breakfast', 'lunch', 'dinner', 'snack'], day)
    expect(all.lunch).toEqual({ min: 595, max: 805, target: 700 })
    const targets = Object.values(all).reduce((sum, range) => sum + (range?.target ?? 0), 0)
    expect(targets).toBe(2000)
    const twoMeals = mealRanges(settings(), ['lunch', 'dinner'], day)
    expect((twoMeals.lunch?.target ?? 0) + (twoMeals.dinner?.target ?? 0)).toBe(2000)
  })

  it('takes a meal’s own limits as they are', () => {
    const custom = settings({ lunch: { kcalMin: 400, kcalMax: 500 }, dinner: { kcalMin: 900, kcalMax: null } })
    const ranges = mealRanges(custom, ['lunch', 'dinner'], dailyRange(custom, CALORIES))
    expect(ranges.lunch).toEqual({ min: 400, max: 500, target: 450 })
    expect(ranges.dinner?.min).toBe(900)
    expect(ranges.dinner?.max).toBeGreaterThanOrEqual(900)
  })
})
