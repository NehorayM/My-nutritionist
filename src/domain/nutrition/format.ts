import { KCAL_ROUNDING } from './constants'

/** Round energy to the nearest 10 kcal. */
export function roundKcal(kcal: number): number {
  return Math.round(kcal / KCAL_ROUNDING) * KCAL_ROUNDING
}

/** Round grams/milligrams to whole units. */
export function roundWhole(value: number): number {
  return Math.round(value)
}

/** Round to one decimal (e.g. iron in mg). */
export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Locale-independent text for a non-negative amount in assumption sentences (deterministic across
 * devices): thousands separated by commas, up to `maxDecimals` decimals without trailing zeros.
 */
export function formatAmount(value: number, maxDecimals = 1): string {
  const scale = 10 ** maxDecimals
  const units = Math.round(Math.abs(value) * scale)
  const whole = String(Math.floor(units / scale)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = String(units % scale).padStart(maxDecimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
