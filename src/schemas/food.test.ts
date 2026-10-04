import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS } from '@/types'
import { makeFood, makeNutrients, USER_A } from './__fixtures__/records'
import { foodItemSchema, servingOptionSchema } from './food'
import { nutrientProfileSchema, nutrientsPer100gSchema } from './nutrition'

describe('nutrientProfileSchema', () => {
  it('keeps unknown values as null — never 0', () => {
    const parsed = nutrientProfileSchema.parse(makeNutrients({ iron: null, vitaminD: 0 }))
    expect(parsed.iron).toBeNull()
    expect(parsed.vitaminD).toBe(0)
  })

  it('fills keys missing from older records with null and strips non-nutrient keys', () => {
    const parsed = nutrientProfileSchema.parse({ calories: 100, alcohol: 5 })
    expect(Object.keys(parsed).sort()).toEqual([...NUTRIENT_KEYS].sort())
    expect(parsed.protein).toBeNull()
    expect('alcohol' in parsed).toBe(false)
  })

  it.each([
    [{ protein: -0.01 }, false],
    [{ protein: 0 }, true],
    [{ sodium: 100000 }, true],
    [{ sodium: 100000.1 }, false],
    [{ fiber: '2' }, false],
    [{ iron: Number.NaN }, false],
  ])('%j valid=%s', (values, valid) => {
    expect(nutrientProfileSchema.safeParse({ ...makeNutrients(), ...values }).success).toBe(valid)
  })

  it('caps calories per 100 g at 1000 like the database', () => {
    expect(nutrientsPer100gSchema.safeParse(makeNutrients({ calories: 1000 })).success).toBe(true)
    expect(nutrientsPer100gSchema.safeParse(makeNutrients({ calories: 1000.5 })).success).toBe(false)
    expect(nutrientsPer100gSchema.safeParse(makeNutrients({ calories: null })).success).toBe(true)
  })
})

describe('servingOptionSchema', () => {
  it.each([
    [{ label: '1 cup', grams: 240 }, true],
    [{ label: '', grams: 240 }, false],
    [{ label: '1 cup', grams: 0 }, false],
    [{ label: '1 cup', grams: 5000 }, true],
    [{ label: '1 cup', grams: 5000.5 }, false],
  ])('%j valid=%s', (value, valid) => {
    expect(servingOptionSchema.safeParse(value).success).toBe(valid)
  })
})

describe('foodItemSchema', () => {
  it('accepts a complete user food and preserves null allergen info', () => {
    const parsed = foodItemSchema.parse(makeFood())
    expect(parsed.allergens).toBeNull()
    expect(parsed.dietFlags).toEqual({ vegetarian: true, vegan: null })
  })

  it('requires system foods to have no owner and user foods to have one', () => {
    expect(foodItemSchema.safeParse(makeFood({ source: 'system', createdBy: null })).success).toBe(true)
    expect(foodItemSchema.safeParse(makeFood({ source: 'system', createdBy: USER_A })).success).toBe(false)
    expect(foodItemSchema.safeParse(makeFood({ source: 'usda', createdBy: null })).success).toBe(false)
  })

  it('ignores meal slots this app version does not know instead of rejecting the food', () => {
    const parsed = foodItemSchema.parse({ ...makeFood(), mealTypes: ['lunch', 'brunch'] })
    expect(parsed.mealTypes).toEqual(['lunch'])
  })

  it.each([
    ['barcode', '12345', false],
    ['barcode', '123456', true],
    ['barcode', '12345678901234', true],
    ['barcode', '123456789012345', false],
    ['barcode', '12345a', false],
    ['name', '', false],
    ['name', 'x'.repeat(200), true],
    ['name', 'x'.repeat(201), false],
    ['externalId', '', false],
    ['externalId', 'x'.repeat(64), true],
    ['externalId', 'x'.repeat(65), false],
    ['brand', 'x'.repeat(121), false],
    ['costTier', 0, false],
    ['costTier', 3, true],
    ['costTier', 4, false],
    ['prepMinutes', 600, true],
    ['prepMinutes', 601, false],
    ['allergens', ['milk', 'nuts'], false],
    ['category', 'dessert', false],
    ['servings', Array.from({ length: 21 }, () => ({ label: 'x', grams: 1 })), false],
    ['tags', Array.from({ length: 31 }, (_, i) => `t${i}`), false],
  ])('%s = %j valid=%s', (field, value, valid) => {
    expect(foodItemSchema.safeParse({ ...makeFood(), [field]: value }).success).toBe(valid)
  })
})
