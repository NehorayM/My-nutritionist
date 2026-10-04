/**
 * Single bridge to the pure-TypeScript USDA module shared with the `food-search` Edge Function,
 * so client code never repeats the long relative path (the module lives outside `src/`).
 */
export {
  FOOD_SEARCH_FUNCTION,
  USDA_DATA_TYPES,
  USDA_NUTRIENT_KEYS,
  USDA_REQUEST_LIMITS,
  USDA_SEARCH_SCOPES,
  USDA_SOURCE_NAME,
  type UsdaDataType,
  type UsdaFoodDto,
  type UsdaFoodResponseDto,
  type UsdaFunctionRequest,
  type UsdaSearchResponseDto,
  type UsdaSearchScope,
} from '../../../../supabase/functions/_shared/usda/normalize.ts'
export { isPlausible as isPlausibleNutrient } from '../../../../supabase/functions/_shared/usda/nutrients.ts'
export { roundNutrient } from '../../../../supabase/functions/_shared/usda/guards.ts'
export { cleanText, formatAmount, truncate } from '../../../../supabase/functions/_shared/usda/text.ts'

/** Limits matching the food_items table constraints (same values the Edge Function applies). */
export { USDA_LIMITS as FOOD_TEXT_LIMITS } from '../../../../supabase/functions/_shared/usda/types.ts'
