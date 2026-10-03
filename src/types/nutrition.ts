/**
 * Nutrient keys tracked by the app. Order matters for display.
 * Adding a nutrient: append the key here, then add its metadata in `domain/nutrients.ts`.
 */
export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugars',
  'saturatedFat',
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'vitaminC',
  'vitaminD',
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

/** Macronutrients shown on every meal card. */
export const MACRO_KEYS = ['protein', 'carbs', 'fat', 'fiber'] as const satisfies readonly NutrientKey[]
export type MacroKey = (typeof MACRO_KEYS)[number]

/** Micronutrients included in "Micronutrient coverage". */
export const MICRO_KEYS = ['iron', 'calcium', 'vitaminC', 'vitaminD', 'potassium'] as const satisfies readonly NutrientKey[]
export type MicroKey = (typeof MICRO_KEYS)[number]

/**
 * Amount of each nutrient. `null` means the value is UNKNOWN for this food —
 * it must never be silently treated as zero.
 * Units: calories kcal; protein/carbs/fat/fiber/sugars/saturatedFat g;
 * sodium/potassium/calcium/iron/vitaminC mg; vitaminD µg.
 */
export type NutrientProfile = Record<NutrientKey, number | null>

/** Aggregated amount of one nutrient across several foods, with data availability. */
export interface NutrientTotal {
  /** Sum of all KNOWN values (0 when nothing is known). */
  value: number
  /** Number of contributing items that had a known value. */
  knownCount: number
  /** Number of contributing items whose value was unknown (null). */
  missingCount: number
}

export type NutrientTotals = Record<NutrientKey, NutrientTotal>
