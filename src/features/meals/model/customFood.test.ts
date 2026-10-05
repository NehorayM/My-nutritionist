import { describe, expect, it } from 'vitest'
import {
  customFoodValues,
  emptyCustomFood,
  hasErrors,
  toCustomFoodInput,
  toPer100g,
  validateCustomFood,
  type CustomFoodValues,
} from './customFood'

function bar(overrides: Partial<CustomFoodValues> = {}): CustomFoodValues {
  const values = emptyCustomFood()
  return {
    ...values,
    name: ' Oat bar ',
    servingLabel: '',
    servingGrams: 40,
    basis: 'perServing',
    nutrients: { ...values.nutrients, calories: 160, protein: 4, carbs: 24, fat: 5, fiber: 2 },
    ...overrides,
  }
}

describe('custom food model', () => {
  it('converts per-serving values to per 100 g and keeps blanks unknown', () => {
    const per100g = toPer100g(bar())
    expect(per100g).toMatchObject({ calories: 400, protein: 10, carbs: 60, fat: 12.5, fiber: 5 })
    expect(per100g.sodium).toBeNull()
    expect(per100g.vitaminD).toBeNull()
    expect(toPer100g(bar({ basis: 'per100g' })).calories).toBe(160)
  })

  it('builds the store input with a default serving name and unknown allergens', () => {
    const input = toCustomFoodInput(bar())
    expect(input).toMatchObject({ name: 'Oat bar', brand: null, servings: [{ label: '1 serving', grams: 40 }], allergens: null })
    expect(input.dietFlags).toEqual({ vegetarian: null, vegan: null })
    expect(toCustomFoodInput(bar({ noAllergens: true })).allergens).toEqual([])
    expect(toCustomFoodInput(bar({ allergens: ['milk'], vegan: true })).dietFlags).toEqual({ vegetarian: true, vegan: true })
  })

  it('requires a name, the energy macros and a serving size for per-serving values', () => {
    const errors = validateCustomFood(emptyCustomFood())
    expect(errors).toMatchObject({ name: 'Enter a name.', calories: 'Enter a value (0 if there is none).', fat: 'Enter a value (0 if there is none).' })
    expect(validateCustomFood(bar({ servingGrams: null })).servingGrams).toBe('Add the serving size to enter values per serving.')
    expect(validateCustomFood(bar({ basis: 'per100g', servingGrams: null, servingLabel: '1 bar' })).servingGrams).toBe(
      'Add how many grams one serving weighs.',
    )
    expect(hasErrors(validateCustomFood(bar()))).toBe(false)
  })

  it('rejects impossible values per 100 g', () => {
    expect(validateCustomFood(bar({ servingGrams: 10 })).calories).toMatch(/more than 1,000 kcal per 100 g/)
    const macros = bar({ basis: 'per100g', nutrients: { ...bar().nutrients, protein: 50, carbs: 50, fat: 20 } })
    expect(validateCustomFood(macros).macros).toMatch(/add up to more than 100 g/)
  })

  it('reads an existing food back as per-100 g values', () => {
    const values = customFoodValues({
      ...toCustomFoodInput(bar()),
      id: 'x',
      source: 'custom',
      externalId: null,
      barcode: null,
      category: null,
      tags: [],
      mealTypes: [],
      prepMinutes: null,
      requiresCooking: null,
      costTier: null,
      attribution: null,
      createdBy: 'me',
      createdAt: '2026-10-07T10:00:00.000Z',
      updatedAt: '2026-10-07T10:00:00.000Z',
    })
    expect(values).toMatchObject({ name: 'Oat bar', basis: 'per100g', servingLabel: '1 serving', servingGrams: 40, noAllergens: false })
    expect(values.nutrients.calories).toBe(400)
  })
})
