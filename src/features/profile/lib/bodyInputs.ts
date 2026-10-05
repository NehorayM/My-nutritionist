import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, roundTo } from '@/domain/units'
import { LIMITS } from '@/schemas'
import type { UnitSystem } from '@/types'

/** Height as the user edits it: centimeters (metric) or feet + inches (imperial). */
export interface HeightInput {
  cm: number | null
  feet: number | null
  inches: number | null
}

export function heightInputFrom(cm: number | null): HeightInput {
  if (cm === null) return { cm: null, feet: null, inches: null }
  const { feet, inches } = cmToFeetInches(cm)
  return { cm: roundTo(cm, 1), feet, inches }
}

/** Canonical centimeters, or null when nothing was entered. */
export function heightCmFrom(input: HeightInput, units: UnitSystem): number | null {
  if (units === 'metric') return input.cm
  if (input.feet === null && input.inches === null) return null
  return roundTo(feetInchesToCm(input.feet ?? 0, input.inches ?? 0), 1)
}

export function validHeight(cm: number | null): boolean {
  return cm === null || (cm >= LIMITS.heightCm.min && cm <= LIMITS.heightCm.max)
}

/** Weight in the user's display unit. */
export function weightInputFrom(kg: number | null, units: UnitSystem): number | null {
  if (kg === null) return null
  return roundTo(units === 'imperial' ? kgToLb(kg) : kg, 1)
}

export function weightKgFrom(value: number | null, units: UnitSystem): number | null {
  if (value === null) return null
  return roundTo(units === 'imperial' ? lbToKg(value) : value, 2)
}

export function validWeight(kg: number | null): boolean {
  return kg === null || (kg >= LIMITS.weightKg.min && kg <= LIMITS.weightKg.max)
}

export function weightRangeText(units: UnitSystem): string {
  return units === 'imperial'
    ? `${Math.round(kgToLb(LIMITS.weightKg.min))}–${Math.round(kgToLb(LIMITS.weightKg.max))} lb`
    : `${LIMITS.weightKg.min}–${LIMITS.weightKg.max} kg`
}
