import { describe, expect, it } from 'vitest'
import { inputValueToKg, kgInUnit, kgToInputValue, weightError, weightLimitsIn, weightUnitFor } from './weightUnits'

describe('weight unit helpers', () => {
  it('maps the unit system to a weight unit', () => {
    expect(weightUnitFor('metric')).toBe('kg')
    expect(weightUnitFor('imperial')).toBe('lb')
  })

  it('converts between stored kg and form values', () => {
    expect(kgToInputValue(71.21, 'lb')).toBe(157)
    expect(kgToInputValue(71.2149, 'kg')).toBe(71.21)
    expect(inputValueToKg(157, 'lb')).toBe(71.21)
    expect(inputValueToKg(71.234, 'kg')).toBe(71.23)
    expect(kgInUnit(10, 'lb')).toBeCloseTo(22.046, 3)
    expect(kgInUnit(10, 'kg')).toBe(10)
  })

  it('keeps the shown range inside the stored kg limits', () => {
    expect(weightLimitsIn('kg')).toEqual({ min: 20, max: 400 })
    expect(weightLimitsIn('lb')).toEqual({ min: 45, max: 881 })
    expect(inputValueToKg(45, 'lb')).toBeGreaterThanOrEqual(20)
    expect(inputValueToKg(881, 'lb')).toBeLessThanOrEqual(400)
  })

  it('describes empty and out-of-range values', () => {
    expect(weightError(null, 'kg', 'Enter your weight.')).toBe('Enter your weight.')
    expect(weightError(19.9, 'kg', '')).toBe('Enter a weight between 20 and 400 kg.')
    expect(weightError(882, 'lb', '')).toBe('Enter a weight between 45 and 881 lb.')
    expect(weightError(400, 'kg', '')).toBeNull()
    expect(weightError(45, 'lb', '')).toBeNull()
  })
})
