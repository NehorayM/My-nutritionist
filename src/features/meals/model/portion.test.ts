import { describe, expect, it } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { nutrientProfile } from '@/domain/nutrients'
import type { FoodItem } from '@/types'
import {
  GRAMS_UNIT,
  buildPortion,
  defaultPortionValues,
  formatPortionAmount,
  formatQuantity,
  portionError,
  portionGrams,
  portionValuesOf,
  servingUnitName,
  switchUnit,
  unitOptionText,
  unitOptions,
} from './portion'

const banana = systemFoodBySlug('banana') as FoodItem

describe('portion model', () => {
  it('formats amounts as grams or quantity × serving with the total weight', () => {
    expect(formatPortionAmount({ quantity: 150, servingLabel: null, grams: 150 })).toBe('150 g')
    expect(formatPortionAmount({ quantity: 1, servingLabel: '1 cup (158 g)', grams: 158 })).toBe('1 cup (158 g)')
    expect(formatPortionAmount({ quantity: 1.5, servingLabel: '1 cup (240 g)', grams: 360 })).toBe('1.5 × 1 cup (360 g)')
    expect(formatPortionAmount({ quantity: 2.5, servingLabel: null, grams: 2.5 })).toBe('2.5 g')
    expect(servingUnitName('1 slice, large pizza (119 g)')).toBe('1 slice, large pizza')
    expect(formatQuantity(1 / 3)).toBe('0.33')
  })

  it('offers grams first, then the food’s servings, keeping a logged unit the food no longer lists', () => {
    const options = unitOptions(banana.servings, { servingLabel: '1 bunch', servingGrams: 600 })
    expect(options.map(unitOptionText)).toEqual([
      'grams',
      '1 medium banana (118 g)',
      '1 small banana (101 g)',
      '1 cup, sliced (150 g)',
      '1 bunch (600 g)',
    ])
  })

  it('computes grams for serving units and keeps the weight when switching to grams', () => {
    const options = unitOptions(banana.servings)
    const values = { ...defaultPortionValues(banana.servings), quantity: 1.5 }
    expect(portionGrams(values, options)).toBe(177)
    const grams = switchUnit(values, options, GRAMS_UNIT)
    expect(grams).toEqual({ unit: GRAMS_UNIT, quantity: 177 })
    expect(switchUnit(grams, options, options[2]!.value)).toEqual({ unit: options[2]!.value, quantity: 1 })
    expect(defaultPortionValues([])).toEqual({ unit: GRAMS_UNIT, quantity: 100 })
  })

  it('validates amounts with clear messages', () => {
    const options = unitOptions(banana.servings)
    expect(portionError({ unit: GRAMS_UNIT, quantity: 0 }, options)).toBe('Enter an amount greater than 0.')
    expect(portionError({ unit: GRAMS_UNIT, quantity: 6000 }, options)).toMatch(/more than 5,000 g/)
    expect(portionError({ unit: options[1]!.value, quantity: 50 }, options)).toMatch(/more than 5,000 g/)
    expect(portionGrams({ unit: GRAMS_UNIT, quantity: null }, options)).toBeNull()
  })

  it('builds a portion snapshot; unsaved provider results are not referenced by id', () => {
    const options = unitOptions(banana.servings)
    const portion = buildPortion(banana, { unit: options[1]!.value, quantity: 2 }, options)
    expect(portion).toMatchObject({
      foodId: banana.id,
      foodSource: 'system',
      quantity: 2,
      servingLabel: '1 medium banana (118 g)',
      servingGrams: 118,
      grams: 236,
    })
    expect(portionValuesOf(portion!)).toEqual({ unit: options[1]!.value, quantity: 2 })

    const usda: FoodItem = { ...banana, id: '0b0b0b0b-0000-5000-8000-000000000001', source: 'usda', externalId: '42', createdBy: null }
    const unsaved = buildPortion(usda, { unit: GRAMS_UNIT, quantity: 80 }, options)
    expect(unsaved).toMatchObject({ foodId: null, foodSource: 'usda', foodExternalId: '42', quantity: 80, servingLabel: null, grams: 80 })
    expect(buildPortion({ ...banana, per100g: nutrientProfile({}) }, { unit: GRAMS_UNIT, quantity: 0 }, options)).toBeNull()
  })
})
