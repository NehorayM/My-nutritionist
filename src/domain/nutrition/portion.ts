import { NUTRIENT_KEYS, type FoodPortion, type NutrientProfile } from '@/types'

/** Decimal places kept for computed grams (strips floating-point noise such as 0.30000000000000004). */
const GRAMS_DECIMALS = 3

/** A usable nutrient amount: finite and ≥ 0. Anything else counts as unknown. */
export function isKnownAmount(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function assertAmount(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite number ≥ 0 (got ${value})`)
}

/**
 * Food Nutrient Calculation Engine: nutrients in `grams` of a food given its per-100 g values.
 * `nutrient = per100g × grams / 100`. Unknown values (null — or non-finite/negative data) stay null;
 * results are not rounded, so sums stay exact and the UI decides display precision.
 * @throws RangeError when grams is negative, NaN or infinite.
 */
export function scaleNutrients(per100g: NutrientProfile, grams: number): NutrientProfile {
  assertAmount('grams', grams)
  const scaled = {} as NutrientProfile
  for (const key of NUTRIENT_KEYS) {
    const value = per100g[key]
    scaled[key] = isKnownAmount(value) ? (value * grams) / 100 : null
  }
  return scaled
}

/** Nutrients of a logged/recommended portion (uses its per-100 g snapshot and total grams). */
export function portionNutrients(portion: Pick<FoodPortion, 'per100g' | 'grams'>): NutrientProfile {
  return scaleNutrients(portion.per100g, portion.grams)
}

/**
 * Total grams for `quantity` serving units: quantity × (servingGrams ?? 1); a null serving means the
 * unit is grams. Rounded to 0.001 g.
 * @throws RangeError for a negative/non-finite quantity or a non-positive/non-finite serving size.
 */
export function gramsForQuantity(quantity: number, servingGrams: number | null): number {
  assertAmount('quantity', quantity)
  if (servingGrams !== null && (!Number.isFinite(servingGrams) || servingGrams <= 0)) {
    throw new RangeError(`servingGrams must be a finite number > 0 (got ${servingGrams})`)
  }
  const factor = 10 ** GRAMS_DECIMALS
  return Math.round(quantity * (servingGrams ?? 1) * factor) / factor
}
