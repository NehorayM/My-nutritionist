import { describe, expect, it } from 'vitest'
import { MIN_ENTRY_GRAMS, foodKey, portionAmountError, recentFoods, toPortion } from './foodLog'
import { DEFAULT_MEAL_SLOTS, mealLabel, mealTypeForTime } from './meals'
import { nutrientProfile } from './nutrients'
import { ADULT_AGE, createDefaultProfile, isMinor, missingProfileFields, profileAge } from './profile'
import type { MealEntry } from '@/types'

describe('profile helpers', () => {
  const profile = createDefaultProfile('u1', '2026-10-05T08:00:00.000Z')

  it('creates a neutral default profile with general wellness settings', () => {
    expect(profile).toMatchObject({ userId: 'u1', goal: 'general_wellness', dietType: 'balanced', unitSystem: 'metric', birthDate: null })
    expect(profile.createdAt).toBe(profile.updatedAt)
  })

  it('derives age and minor status from the birth date', () => {
    expect(profileAge({ birthDate: null }, '2026-10-05')).toBeNull()
    expect(profileAge({ birthDate: '2026-02-30' }, '2026-10-05')).toBeNull()
    expect(profileAge({ birthDate: '1990-10-06' }, '2026-10-05')).toBe(35)
    expect(isMinor({ birthDate: '2010-01-01' }, '2026-10-05')).toBe(true)
    expect(isMinor({ birthDate: `${2026 - ADULT_AGE}-10-05` }, '2026-10-05')).toBe(false)
    expect(isMinor({ birthDate: null }, '2026-10-05')).toBe(false)
  })

  it('lists the fields needed for a personalized estimate', () => {
    expect(missingProfileFields(null, null)).toEqual(['birthDate', 'heightCm', 'weight'])
    expect(missingProfileFields(profile, null)).toEqual(['birthDate', 'heightCm', 'weight'])
    expect(missingProfileFields({ birthDate: '1990-01-01', heightCm: 170, currentWeightKg: null }, 70)).toEqual([])
    expect(missingProfileFields({ birthDate: '1990-01-01', heightCm: null, currentWeightKg: 70 }, null)).toEqual(['heightCm'])
  })
})

describe('meal slots', () => {
  it('labels slots and falls back to the key for unknown slots', () => {
    expect(DEFAULT_MEAL_SLOTS.map((slot) => slot.key)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
    expect(mealLabel('snack')).toBe('Snacks')
    expect(mealLabel('brunch' as 'snack')).toBe('brunch')
  })

  it('picks the main meal for a time of day (never snacks)', () => {
    expect(mealTypeForTime(new Date(2026, 9, 5, 7))).toBe('breakfast')
    expect(mealTypeForTime(new Date(2026, 9, 5, 12))).toBe('lunch')
    expect(mealTypeForTime(new Date(2026, 9, 5, 19))).toBe('dinner')
    expect(mealTypeForTime(new Date(2026, 9, 5, 23, 30))).toBe('dinner')
  })
})

describe('food log helpers', () => {
  it('validates amounts with clear, neutral messages', () => {
    expect(portionAmountError(null, null)).toBe('Enter an amount.')
    expect(portionAmountError(Number.NaN, null)).toBe('Enter an amount.')
    expect(portionAmountError(0, null)).toBe('Enter an amount greater than 0.')
    expect(portionAmountError(1, 0)).toMatch(/serving size can’t be used/)
    expect(portionAmountError(1, 6000)).toMatch(/serving size can’t be used/)
    expect(portionAmountError(MIN_ENTRY_GRAMS / 2, null)).toMatch(/too small/)
    expect(portionAmountError(6000, null)).toMatch(/more than 5,000 g/)
    expect(portionAmountError(20000, 0.1)).toMatch(/at most 10,000 servings/)
    expect(portionAmountError(150, null)).toBeNull()
    expect(portionAmountError(1.5, 240)).toBeNull()
  })

  const entry = (id: string, loggedAt: string, overrides: Partial<MealEntry> = {}): MealEntry => ({
    id,
    userId: 'u1',
    date: loggedAt.slice(0, 10),
    mealType: 'lunch',
    loggedAt,
    createdAt: loggedAt,
    updatedAt: loggedAt,
    foodId: 'f1',
    foodSource: 'system',
    foodExternalId: null,
    foodName: 'Hummus',
    brand: null,
    quantity: 70,
    servingLabel: null,
    servingGrams: null,
    grams: 70,
    per100g: nutrientProfile({ calories: 243 }),
    ...overrides,
  })

  it('identifies foods by provider record, then id, then name and brand', () => {
    expect(foodKey(entry('a', '2026-10-05T10:00:00Z', { foodSource: 'usda', foodExternalId: '171477' }))).toBe('usda:171477')
    expect(foodKey(entry('a', '2026-10-05T10:00:00Z'))).toBe('id:f1')
    expect(foodKey(entry('a', '2026-10-05T10:00:00Z', { foodId: null, foodName: ' Pita ', brand: 'Angel' }))).toBe('name:pita|angel')
  })

  it('builds recent foods newest first, one per food, with the last-used portion', () => {
    const older = entry('a', '2026-10-04T10:00:00Z', { grams: 50, quantity: 50 })
    const newer = entry('b', '2026-10-05T10:00:00Z', { grams: 120, quantity: 120 })
    const other = entry('c', '2026-10-03T10:00:00Z', { foodId: 'f2', foodName: 'Pita bread' })
    const recent = recentFoods([older, other, newer])
    expect(recent.map((food) => [food.key, food.portion.grams])).toEqual([
      ['id:f1', 120],
      ['id:f2', 70],
    ])
    expect(toPortion(newer)).not.toHaveProperty('id')
    expect(toPortion(newer).per100g).not.toBe(newer.per100g)
  })
})
