import { NUTRIENTS } from '@/domain/nutrients'
import { formatNumber } from '@/lib/format'
import { LIMITS, TEXT_LIMITS, textLength } from '@/schemas'
import type { CustomFoodInput } from '@/stores/foodLibraryStore'
import { MICRO_KEYS, NUTRIENT_KEYS, type Allergen, type FoodItem, type NutrientKey, type NutrientProfile } from '@/types'

export const NUTRIENT_BASES = ['per100g', 'perServing'] as const
export type NutrientBasis = (typeof NUTRIENT_BASES)[number]

/** Calories and the three energy macros are required; everything else may stay blank (unknown). */
export const REQUIRED_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'] as const satisfies readonly NutrientKey[]
export const OPTIONAL_NUTRIENTS = ['fiber', 'sugars', 'saturatedFat', 'sodium'] as const satisfies readonly NutrientKey[]
export const MICRO_NUTRIENTS = MICRO_KEYS

const DEFAULT_SERVING_LABEL = '1 serving'
const REQUIRED_MESSAGE = 'Enter a value (0 if there is none).'
/** Protein + carbs + fat can't exceed 100 g per 100 g (small allowance for rounded labels). */
const MACRO_SUM_ALLOWANCE = 2

export interface CustomFoodValues {
  name: string
  brand: string
  servingLabel: string
  servingGrams: number | null
  basis: NutrientBasis
  nutrients: Record<NutrientKey, number | null>
  allergens: Allergen[]
  /** The user confirmed the food contains none of the listed allergens. */
  noAllergens: boolean
  vegetarian: boolean
  vegan: boolean
}

export type CustomFoodField = 'name' | 'brand' | 'servingLabel' | 'servingGrams' | 'macros' | NutrientKey
export type CustomFoodErrors = Partial<Record<CustomFoodField, string>>

export function emptyCustomFood(): CustomFoodValues {
  const nutrients = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, null])) as Record<NutrientKey, number | null>
  return { name: '', brand: '', servingLabel: '', servingGrams: null, basis: 'per100g', nutrients, allergens: [], noAllergens: false, vegetarian: false, vegan: false }
}

export function customFoodValues(food: FoodItem): CustomFoodValues {
  const serving = food.servings[0]
  return {
    name: food.name,
    brand: food.brand ?? '',
    servingLabel: serving?.label ?? '',
    servingGrams: serving?.grams ?? null,
    basis: 'per100g',
    nutrients: { ...food.per100g },
    allergens: food.allergens ?? [],
    noAllergens: food.allergens?.length === 0,
    vegetarian: food.dietFlags.vegetarian === true,
    vegan: food.dietFlags.vegan === true,
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Per-100 g values: per-serving entries are scaled by 100 / serving grams. Blank stays null (unknown). */
export function toPer100g(values: CustomFoodValues): NutrientProfile {
  const factor = values.basis === 'perServing' && values.servingGrams ? 100 / values.servingGrams : 1
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => {
      const value = values.nutrients[key]
      return [key, value === null ? null : round2(value * factor)]
    }),
  ) as NutrientProfile
}

function maxPer100g(key: NutrientKey): number {
  if (key === 'calories') return LIMITS.caloriesPer100g.max
  return NUTRIENTS[key].unit === 'g' ? 100 : LIMITS.nutrientValue.max
}

function nutrientErrors(values: CustomFoodValues, errors: CustomFoodErrors): void {
  for (const key of REQUIRED_NUTRIENTS) if (values.nutrients[key] === null) errors[key] = REQUIRED_MESSAGE
  const per100g = toPer100g(values)
  const unitText = values.basis === 'perServing' ? ' Check the value and the serving size.' : ''
  for (const key of NUTRIENT_KEYS) {
    const value = per100g[key]
    if (value === null || errors[key]) continue
    const max = maxPer100g(key)
    if (value > max) errors[key] = `That’s more than ${formatNumber(max)} ${NUTRIENTS[key].unit} per 100 g.${unitText}`
  }
  const macros = (per100g.protein ?? 0) + (per100g.carbs ?? 0) + (per100g.fat ?? 0)
  if (!errors.protein && !errors.carbs && !errors.fat && macros > 100 + MACRO_SUM_ALLOWANCE) {
    errors.macros = `Protein, carbs and fat add up to more than 100 g per 100 g.${unitText}`
  }
}

export function validateCustomFood(values: CustomFoodValues): CustomFoodErrors {
  const errors: CustomFoodErrors = {}
  const name = values.name.trim()
  if (name.length === 0) errors.name = 'Enter a name.'
  else if (textLength(name) > TEXT_LIMITS.foodName) errors.name = `Use at most ${TEXT_LIMITS.foodName} characters.`
  if (textLength(values.brand.trim()) > TEXT_LIMITS.brand) errors.brand = `Use at most ${TEXT_LIMITS.brand} characters.`
  if (textLength(values.servingLabel.trim()) > TEXT_LIMITS.servingLabel) errors.servingLabel = `Use at most ${TEXT_LIMITS.servingLabel} characters.`
  const grams = values.servingGrams
  if (grams !== null && !(grams > 0 && grams <= LIMITS.servingGrams.max)) {
    errors.servingGrams = `Enter a serving size between 0 and ${formatNumber(LIMITS.servingGrams.max)} g.`
  } else if (grams === null && values.servingLabel.trim()) {
    errors.servingGrams = 'Add how many grams one serving weighs.'
  } else if (grams === null && values.basis === 'perServing') {
    errors.servingGrams = 'Add the serving size to enter values per serving.'
  }
  if (!errors.servingGrams) nutrientErrors(values, errors)
  else for (const key of REQUIRED_NUTRIENTS) if (values.nutrients[key] === null) errors[key] = REQUIRED_MESSAGE
  return errors
}

export function hasErrors(errors: CustomFoodErrors): boolean {
  return Object.values(errors).some(Boolean)
}

export function toCustomFoodInput(values: CustomFoodValues): CustomFoodInput {
  const grams = values.servingGrams
  const label = values.servingLabel.trim() || DEFAULT_SERVING_LABEL
  const allergens = values.noAllergens ? [] : values.allergens.length > 0 ? [...values.allergens] : null
  return {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    servings: grams === null ? [] : [{ label, grams }],
    per100g: toPer100g(values),
    allergens,
    dietFlags: { vegetarian: values.vegetarian || values.vegan ? true : null, vegan: values.vegan ? true : null },
  }
}
