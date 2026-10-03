import { NUTRIENT_KEYS, type NutrientKey, type NutrientProfile, type NutrientTotals } from '@/types'

export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'µg'

/** energy = calories; macro = shown on every card; detail = progressive disclosure; micro = coverage set. */
export type NutrientGroup = 'energy' | 'macro' | 'detail' | 'micro'

export interface NutrientMeta {
  key: NutrientKey
  label: string
  shortLabel: string
  unit: NutrientUnit
  /** Decimal places for display. Values are estimates — avoid false precision. */
  decimals: number
  group: NutrientGroup
}

export const NUTRIENTS: Record<NutrientKey, NutrientMeta> = {
  calories: { key: 'calories', label: 'Calories', shortLabel: 'kcal', unit: 'kcal', decimals: 0, group: 'energy' },
  protein: { key: 'protein', label: 'Protein', shortLabel: 'Protein', unit: 'g', decimals: 0, group: 'macro' },
  carbs: { key: 'carbs', label: 'Carbohydrates', shortLabel: 'Carbs', unit: 'g', decimals: 0, group: 'macro' },
  fat: { key: 'fat', label: 'Fat', shortLabel: 'Fat', unit: 'g', decimals: 0, group: 'macro' },
  fiber: { key: 'fiber', label: 'Fiber', shortLabel: 'Fiber', unit: 'g', decimals: 0, group: 'macro' },
  sugars: { key: 'sugars', label: 'Sugars', shortLabel: 'Sugars', unit: 'g', decimals: 0, group: 'detail' },
  saturatedFat: { key: 'saturatedFat', label: 'Saturated fat', shortLabel: 'Sat. fat', unit: 'g', decimals: 0, group: 'detail' },
  sodium: { key: 'sodium', label: 'Sodium', shortLabel: 'Sodium', unit: 'mg', decimals: 0, group: 'detail' },
  potassium: { key: 'potassium', label: 'Potassium', shortLabel: 'Potassium', unit: 'mg', decimals: 0, group: 'micro' },
  calcium: { key: 'calcium', label: 'Calcium', shortLabel: 'Calcium', unit: 'mg', decimals: 0, group: 'micro' },
  iron: { key: 'iron', label: 'Iron', shortLabel: 'Iron', unit: 'mg', decimals: 1, group: 'micro' },
  vitaminC: { key: 'vitaminC', label: 'Vitamin C', shortLabel: 'Vit. C', unit: 'mg', decimals: 0, group: 'micro' },
  vitaminD: { key: 'vitaminD', label: 'Vitamin D', shortLabel: 'Vit. D', unit: 'µg', decimals: 1, group: 'micro' },
}

/** A profile where every nutrient is unknown. */
export function unknownNutrients(): NutrientProfile {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null])) as NutrientProfile
}

/** Build a full profile from a partial one; omitted keys become unknown (null). */
export function nutrientProfile(partial: Partial<NutrientProfile>): NutrientProfile {
  const profile = unknownNutrients()
  for (const key of NUTRIENT_KEYS) {
    const value = partial[key]
    profile[key] = value === undefined ? null : value
  }
  return profile
}

/** Totals for an empty set of foods. */
export function emptyTotals(): NutrientTotals {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, { value: 0, knownCount: 0, missingCount: 0 }]),
  ) as NutrientTotals
}
