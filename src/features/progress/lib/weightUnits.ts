import { kgToLb, lbToKg, roundTo } from '@/domain/units'
import { LIMITS } from '@/schemas/limits'
import type { UnitSystem, WeightUnit } from '@/types'

/** Stored kilograms keep two decimals (same rounding as the weight store). */
const STORED_KG_DECIMALS = 2

export function weightUnitFor(unitSystem: UnitSystem): WeightUnit {
  return unitSystem === 'imperial' ? 'lb' : 'kg'
}

/** A stored kg value as the number a form field should show (kg: 2 decimals, lb: 1 decimal). */
export function kgToInputValue(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? roundTo(kgToLb(kg), 1) : roundTo(kg, STORED_KG_DECIMALS)
}

/** A typed value in `unit` as canonical kilograms. */
export function inputValueToKg(value: number, unit: WeightUnit): number {
  return roundTo(unit === 'lb' ? lbToKg(value) : value, STORED_KG_DECIMALS)
}

/** A stored kg value in the display unit, unrounded (for charts and tables). */
export function kgInUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : kg
}

/**
 * Accepted body-weight range in the user's unit: the stored kg limits, rounded inward so a value inside
 * the shown range always converts to a valid kg value (kg 20–400, lb 45–881).
 */
export function weightLimitsIn(unit: WeightUnit): { min: number; max: number } {
  const { min, max } = LIMITS.weightKg
  if (unit === 'kg') return { min, max }
  return { min: Math.ceil(kgToLb(min)), max: Math.floor(kgToLb(max)) }
}

/** Validation message for a body-weight field, or null when the value is acceptable. */
export function weightError(value: number | null, unit: WeightUnit, emptyMessage: string): string | null {
  if (value === null) return emptyMessage
  const { min, max } = weightLimitsIn(unit)
  if (value < min || value > max) return `Enter a weight between ${min} and ${max} ${unit}.`
  return null
}
