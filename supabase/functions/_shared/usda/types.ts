/**
 * Normalized USDA FoodData Central DTO returned by the `food-search` Edge Function
 * (see docs/contracts/food-search-function.md). Shared by the Edge Function and the client.
 */

/** Mirrors NUTRIENT_KEYS in src/types/nutrition.ts (kept in sync by a unit test). */
export const USDA_NUTRIENT_KEYS = [
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
export type UsdaNutrientKey = (typeof USDA_NUTRIENT_KEYS)[number]

/** Per 100 g; unknown = null. kcal; g for macros; mg for sodium/potassium/calcium/iron/vitaminC; µg for vitaminD. */
export type UsdaNutrientProfile = Record<UsdaNutrientKey, number | null>

export const USDA_DATA_TYPES = ['foundation', 'sr_legacy', 'survey_fndds', 'branded'] as const
export type UsdaDataType = (typeof USDA_DATA_TYPES)[number]

/** FDC `dataType` strings as returned by the API. */
export const FDC_DATA_TYPE_NAMES: Record<UsdaDataType, string> = {
  foundation: 'Foundation',
  sr_legacy: 'SR Legacy',
  survey_fndds: 'Survey (FNDDS)',
  branded: 'Branded',
}

export const USDA_SEARCH_SCOPES = ['generic', 'branded'] as const
export type UsdaSearchScope = (typeof USDA_SEARCH_SCOPES)[number]

/** FDC `dataType` filter for a search scope (generic avoids the flood of branded duplicates). */
export function fdcDataTypesForScope(scope: UsdaSearchScope): string[] {
  if (scope === 'branded') return [FDC_DATA_TYPE_NAMES.branded]
  return [FDC_DATA_TYPE_NAMES.foundation, FDC_DATA_TYPE_NAMES.sr_legacy, FDC_DATA_TYPE_NAMES.survey_fndds]
}

export interface UsdaServingDto {
  label: string
  /** Grams for ONE unit of this serving. */
  grams: number
}

export interface UsdaFoodDto {
  /** fdcId as a string. */
  externalId: string
  name: string
  brand: string | null
  /** gtinUpc when 6–14 digits. */
  barcode: string | null
  dataType: UsdaDataType
  per100g: UsdaNutrientProfile
  servings: UsdaServingDto[]
  attribution: string
}

export interface UsdaSearchResponseDto {
  page: number
  pageSize: number
  totalHits: number
  totalPages: number
  foods: UsdaFoodDto[]
}

export interface UsdaFoodResponseDto {
  food: UsdaFoodDto
}

/** Name of the Edge Function that proxies USDA FoodData Central. */
export const FOOD_SEARCH_FUNCTION = 'food-search'

/** Request validation bounds (docs/contracts/food-search-function.md). */
export const USDA_REQUEST_LIMITS = {
  queryMin: 2,
  queryMax: 100,
  pageMax: 50,
  pageSizeMax: 50,
} as const

/** Request body of the `food-search` Edge Function. */
export type UsdaFunctionRequest =
  | { action: 'search'; query: string; page: number; pageSize: number; scope: UsdaSearchScope }
  | { action: 'food'; fdcId: number }

/** Error body of the `food-search` Edge Function. */
export const USDA_ERROR_CODES = [
  'invalid_request',
  'unauthorized',
  'not_found',
  'method_not_allowed',
  'rate_limited',
  'upstream_error',
  'not_configured',
  'timeout',
] as const
export type UsdaErrorCode = (typeof USDA_ERROR_CODES)[number]

/** Limits matching the food_items table constraints. */
export const USDA_LIMITS = {
  nameMax: 200,
  brandMax: 120,
  servingsMax: 20,
  servingLabelMax: 80,
} as const
