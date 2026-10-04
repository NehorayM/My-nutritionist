import { describe, expect, it } from 'vitest'
import { nutrientProfile } from '../nutrients'
import { BANANA, CHEESE_PIZZA } from './__fixtures__/nutrition'
import { gramsForQuantity, isKnownAmount, portionNutrients, scaleNutrients } from './portion'

describe('scaleNutrients', () => {
  it('scales every nutrient linearly from per-100 g values', () => {
    const portion = scaleNutrients(CHEESE_PIZZA, 150)
    expect(portion.calories).toBeCloseTo(399, 10)
    expect(portion.protein).toBeCloseTo(17.1, 10)
    expect(portion.sodium).toBeCloseTo(810, 10)
    expect(portion.iron).toBeCloseTo(3.75, 10)
    expect(portion.vitaminD).toBe(0)
  })

  it('returns the per-100 g values for exactly 100 g', () => {
    expect(scaleNutrients(CHEESE_PIZZA, 100)).toEqual(CHEESE_PIZZA)
  })

  it('handles tiny amounts (0.1 g) without losing precision', () => {
    const portion = scaleNutrients(BANANA, 0.1)
    expect(portion.calories).toBeCloseTo(0.089, 12)
    expect(portion.potassium).toBeCloseTo(0.358, 12)
    expect(portion.saturatedFat).toBeCloseTo(0.000112, 12)
  })

  it('handles huge amounts (5000 g)', () => {
    const portion = scaleNutrients(BANANA, 5000)
    expect(portion.calories).toBe(4450)
    expect(portion.carbs).toBeCloseTo(1142, 9)
    expect(portion.potassium).toBe(17900)
  })

  it('keeps unknown values unknown (null), never 0', () => {
    expect(scaleNutrients(BANANA, 250).vitaminD).toBeNull()
    expect(scaleNutrients(BANANA, 0).vitaminD).toBeNull()
  })

  it('gives zero for known values at 0 g', () => {
    const portion = scaleNutrients(BANANA, 0)
    expect(portion.calories).toBe(0)
    expect(portion.fiber).toBe(0)
  })

  it('treats corrupt per-100 g values (NaN, infinite, negative) as unknown', () => {
    const corrupt = nutrientProfile({ calories: Number.NaN, protein: Number.POSITIVE_INFINITY, fat: -3, carbs: 10 })
    const portion = scaleNutrients(corrupt, 200)
    expect(portion.calories).toBeNull()
    expect(portion.protein).toBeNull()
    expect(portion.fat).toBeNull()
    expect(portion.carbs).toBe(20)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects grams = %s', (grams) => {
    expect(() => scaleNutrients(BANANA, grams)).toThrow(RangeError)
  })
})

describe('portionNutrients', () => {
  it('scales the portion snapshot by its total grams', () => {
    expect(portionNutrients({ per100g: BANANA, grams: 118 }).calories).toBeCloseTo(105.02, 10)
  })

  it('rejects a portion with invalid grams', () => {
    expect(() => portionNutrients({ per100g: BANANA, grams: -5 })).toThrow(RangeError)
  })
})

describe('gramsForQuantity', () => {
  it('multiplies serving units by grams per unit', () => {
    expect(gramsForQuantity(1.5, 118)).toBe(177)
    expect(gramsForQuantity(2, 86)).toBe(172)
  })

  it('treats a null serving as grams', () => {
    expect(gramsForQuantity(250, null)).toBe(250)
    expect(gramsForQuantity(0.1, null)).toBe(0.1)
  })

  it('strips floating-point noise', () => {
    expect(gramsForQuantity(0.1, 3)).toBe(0.3)
    expect(gramsForQuantity(3, 0.1)).toBe(0.3)
  })

  it('allows a zero quantity', () => {
    expect(gramsForQuantity(0, 30)).toBe(0)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects quantity = %s', (quantity) => {
    expect(() => gramsForQuantity(quantity, 30)).toThrow(RangeError)
  })

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])('rejects servingGrams = %s', (servingGrams) => {
    expect(() => gramsForQuantity(1, servingGrams)).toThrow(RangeError)
  })
})

describe('isKnownAmount', () => {
  it('accepts finite non-negative numbers only', () => {
    expect(isKnownAmount(0)).toBe(true)
    expect(isKnownAmount(12.5)).toBe(true)
    expect(isKnownAmount(null)).toBe(false)
    expect(isKnownAmount(undefined)).toBe(false)
    expect(isKnownAmount(-0.1)).toBe(false)
    expect(isKnownAmount(Number.NaN)).toBe(false)
  })
})
