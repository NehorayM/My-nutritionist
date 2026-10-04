import { unknownNutrients } from '@/domain/nutrients'
import type { NutrientKey, NutrientProfile } from '@/types'
import { isPlausibleNutrient, roundNutrient } from './shared'

/**
 * Open Food Facts v2 `nutriments` → per-100 g profile.
 * Every mass `<n>_100g` value is in GRAMS (verified, research §B.5), including minerals and vitamins,
 * so sodium/potassium/calcium/iron/vitamin C are ×1000 (mg) and vitamin D ×1e6 (µg).
 * Only `_100g` keys are read; `_serving`/`_value` (as-entered units) and `nutriments_estimated` are ignored.
 */
export const KJ_PER_KCAL = 4.184
/** EU labelling convention: salt = sodium × 2.5. */
export const SALT_PER_SODIUM = 2.5

const NUMERIC = /^\d+(\.\d+)?([eE][-+]?\d+)?$/

/** Non-negative finite number (numeric strings accepted); never coerces missing/"" to 0. */
export function toNonNegativeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value === 'string' && NUMERIC.test(value.trim())) return Number(value.trim())
  return null
}

type Nutriments = Record<string, unknown>

/**
 * Reads `<name>_100g`. An approximate ("~") zero is an estimate, not a reported zero, so it is unknown.
 * Approximate non-zero and "<"/">" values are kept (they are the label's figures).
 */
function per100(nutriments: Nutriments, name: string): number | null {
  const value = toNonNegativeNumber(nutriments[`${name}_100g`])
  if (value === null) return null
  if (value === 0 && nutriments[`${name}_modifier`] === '~') return null
  return value
}

function scaled(value: number | null, factor: number): number | null {
  return value === null ? null : value * factor
}

function energyKcal(n: Nutriments): number | null {
  const kcal = per100(n, 'energy-kcal')
  if (kcal !== null) return kcal
  // `energy-kj` and the generic `energy` field are both kJ in OFF.
  const kj = per100(n, 'energy-kj') ?? per100(n, 'energy')
  return scaled(kj, 1 / KJ_PER_KCAL)
}

function sodiumMg(n: Nutriments): number | null {
  const sodium = per100(n, 'sodium')
  if (sodium !== null) return sodium * 1000
  const salt = per100(n, 'salt')
  return salt === null ? null : (salt / SALT_PER_SODIUM) * 1000
}

/**
 * Carbohydrates: prefer the explicit total (`carbohydrates-total`, US definition incl. fiber, matching the
 * USDA-sourced catalog), else `carbohydrates` as provided (EU products report available carbohydrates).
 */
function carbsG(n: Nutriments): number | null {
  return per100(n, 'carbohydrates-total') ?? per100(n, 'carbohydrates')
}

export function mapOffNutriments(nutriments: Nutriments | null | undefined): NutrientProfile {
  const profile = unknownNutrients()
  if (!nutriments) return profile
  const raw: Record<NutrientKey, number | null> = {
    calories: energyKcal(nutriments),
    protein: per100(nutriments, 'proteins'),
    carbs: carbsG(nutriments),
    fat: per100(nutriments, 'fat'),
    fiber: per100(nutriments, 'fiber'),
    sugars: per100(nutriments, 'sugars'),
    saturatedFat: per100(nutriments, 'saturated-fat'),
    sodium: sodiumMg(nutriments),
    potassium: scaled(per100(nutriments, 'potassium'), 1000),
    calcium: scaled(per100(nutriments, 'calcium'), 1000),
    iron: scaled(per100(nutriments, 'iron'), 1000),
    vitaminC: scaled(per100(nutriments, 'vitamin-c'), 1000),
    vitaminD: scaled(per100(nutriments, 'vitamin-d'), 1_000_000),
  }
  for (const key of Object.keys(raw) as NutrientKey[]) {
    const value = raw[key]
    // Crowd-sourced typos (e.g. kJ typed into the kcal field) become unknown instead of distorting totals.
    profile[key] = value !== null && isPlausibleNutrient(key, value) ? roundNutrient(value) : null
  }
  return profile
}
