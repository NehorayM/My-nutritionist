import { roundTo } from '@/domain/units'
import { KG_DECIMALS } from './constants'

/** Rounds a kilogram value to grams; `+ 0` turns a rounded −0 into 0. */
export function roundKg(value: number): number {
  return roundTo(value, KG_DECIMALS) + 0
}

/** Arithmetic mean; callers pass a non-empty list. */
export function mean(values: readonly number[]): number {
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

/** A usable kilogram value: finite and above zero. */
export function isPositiveKg(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}
