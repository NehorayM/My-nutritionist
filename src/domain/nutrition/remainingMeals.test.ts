import { describe, expect, it } from 'vitest'
import type { MealType } from '@/types'
import { localTime, TODAY } from './__fixtures__/nutrition'
import { remainingMealSlots } from './remainingMeals'

const logged = (...mealTypes: MealType[]) => mealTypes.map((mealType) => ({ date: TODAY, mealType }))

describe('remainingMealSlots', () => {
  it('returns nothing for a past date', () => {
    expect(remainingMealSlots([], localTime(8), '2026-10-03')).toEqual([])
  })

  it('returns every slot for a future date, even late at night', () => {
    expect(remainingMealSlots(logged('breakfast'), localTime(23, 30), '2026-10-05')).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('early morning with nothing logged: the whole day remains', () => {
    expect(remainingMealSlots([], localTime(7, 30), TODAY)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('drops main meals that were already logged', () => {
    expect(remainingMealSlots(logged('breakfast'), localTime(7, 30), TODAY)).toEqual(['lunch', 'dinner', 'snack'])
    expect(remainingMealSlots(logged('breakfast', 'lunch'), localTime(13), TODAY)).toEqual(['dinner', 'snack'])
  })

  it('keeps snacks available after a snack was logged', () => {
    expect(remainingMealSlots(logged('snack'), localTime(10), TODAY)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('closes meal windows by time of day', () => {
    expect(remainingMealSlots([], localTime(10, 59), TODAY)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
    expect(remainingMealSlots([], localTime(11), TODAY)).toEqual(['lunch', 'dinner', 'snack'])
    expect(remainingMealSlots([], localTime(16, 29), TODAY)).toEqual(['lunch', 'dinner', 'snack'])
    expect(remainingMealSlots([], localTime(16, 30), TODAY)).toEqual(['dinner', 'snack'])
    expect(remainingMealSlots([], localTime(21, 59), TODAY)).toEqual(['dinner', 'snack'])
    expect(remainingMealSlots([], localTime(22), TODAY)).toEqual(['snack'])
    expect(remainingMealSlots([], localTime(22, 59), TODAY)).toEqual(['snack'])
    expect(remainingMealSlots([], localTime(23), TODAY)).toEqual([])
  })

  it('ignores entries logged on other dates', () => {
    const otherDay = [{ date: '2026-10-03', mealType: 'dinner' as const }]
    expect(remainingMealSlots(otherDay, localTime(19), TODAY)).toEqual(['dinner', 'snack'])
  })

  it('uses the local calendar date of `now` just after midnight', () => {
    expect(remainingMealSlots([], localTime(0, 5, '2026-10-05'), TODAY)).toEqual([])
    expect(remainingMealSlots([], localTime(0, 5), TODAY)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })
})
