import { describe, expect, it } from 'vitest'
import { LIMITS } from './limits'
import { makeFavorite, makeMeal, makePortion, makeSavedMeal } from './__fixtures__/records'
import { favoriteSchema, foodPortionSchema, mealEntrySchema, savedMealSchema } from './meal'

describe('foodPortionSchema', () => {
  it('accepts a gram-based portion without serving info', () => {
    const portion = makePortion({ servingLabel: null, servingGrams: null, quantity: 80, grams: 80 })
    expect(foodPortionSchema.parse(portion)).toEqual(portion)
  })

  it.each([
    ['grams', 0, false],
    ['grams', LIMITS.entryGrams.max, true],
    ['grams', LIMITS.entryGrams.storageMax, true],
    ['grams', LIMITS.entryGrams.storageMax + 0.001, false],
    ['quantity', 0, false],
    ['quantity', 10000, true],
    ['quantity', 10000.5, false],
    ['servingGrams', 0, false],
    ['servingGrams', 5000, true],
    ['servingGrams', 5001, false],
    ['foodExternalId', '', true],
    ['foodExternalId', 'x'.repeat(65), false],
    ['foodName', '', false],
    ['servingLabel', 'x'.repeat(81), false],
    ['foodSource', 'manual', false],
    ['foodId', 'not-a-uuid', false],
  ])('%s = %j valid=%s', (field, value, valid) => {
    expect(foodPortionSchema.safeParse({ ...makePortion(), [field]: value }).success).toBe(valid)
  })
})

describe('mealEntrySchema', () => {
  it('accepts a full entry and canonicalizes loggedAt', () => {
    const parsed = mealEntrySchema.parse(makeMeal({ loggedAt: '2026-10-03T10:15:00+03:00' }))
    expect(parsed.loggedAt).toBe('2026-10-03T07:15:00.000Z')
  })

  it.each([
    ['date', '2026-02-30'],
    ['mealType', 'brunch'],
    ['userId', ''],
    ['loggedAt', '2026-10-03T10:15:00'],
  ])('rejects invalid %s', (field, value) => {
    expect(mealEntrySchema.safeParse({ ...makeMeal(), [field]: value }).success).toBe(false)
  })
})

describe('savedMealSchema', () => {
  it('requires 1–20 valid items', () => {
    expect(savedMealSchema.safeParse(makeSavedMeal()).success).toBe(true)
    expect(savedMealSchema.safeParse(makeSavedMeal({ items: [] })).success).toBe(false)
    expect(savedMealSchema.safeParse(makeSavedMeal({ items: Array.from({ length: 20 }, () => makePortion()) })).success).toBe(true)
    expect(savedMealSchema.safeParse(makeSavedMeal({ items: Array.from({ length: 21 }, () => makePortion()) })).success).toBe(false)
    expect(savedMealSchema.safeParse(makeSavedMeal({ items: [makePortion({ grams: -1 })] })).success).toBe(false)
  })

  it('allows no meal slot and limits the name to 80 characters', () => {
    expect(savedMealSchema.safeParse(makeSavedMeal({ mealType: null })).success).toBe(true)
    expect(savedMealSchema.safeParse(makeSavedMeal({ name: 'x'.repeat(80) })).success).toBe(true)
    expect(savedMealSchema.safeParse(makeSavedMeal({ name: 'x'.repeat(81) })).success).toBe(false)
    expect(savedMealSchema.safeParse(makeSavedMeal({ name: '' })).success).toBe(false)
  })
})

describe('favoriteSchema', () => {
  it('requires a food id', () => {
    expect(favoriteSchema.safeParse(makeFavorite()).success).toBe(true)
    expect(favoriteSchema.safeParse({ ...makeFavorite(), foodId: null }).success).toBe(false)
  })
})
