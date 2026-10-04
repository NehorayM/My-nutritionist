/**
 * USDA FoodData Central → normalized UsdaFoodDto (docs/contracts/food-search-function.md).
 * Pure TypeScript with relative `.ts` imports: imported by the `food-search` Edge Function (Deno)
 * and by Vitest, so the mapping is tested once and the client never parses FDC formats.
 */
import { isRecord, readArray, readNumber, readString, type UnknownRecord } from './guards.ts'
import { hasCoreNutrient, mapFdcNutrients, readNutrientRows } from './nutrients.ts'
import { brandedServing, finalizeServings, measureServings, portionServings } from './servings.ts'
import { normalizeGtin, sensibleCase, truncate } from './text.ts'
import {
  FDC_DATA_TYPE_NAMES,
  USDA_DATA_TYPES,
  USDA_LIMITS,
  type UsdaDataType,
  type UsdaFoodDto,
  type UsdaFoodResponseDto,
  type UsdaSearchResponseDto,
  type UsdaServingDto,
} from './types.ts'

export const USDA_SOURCE_NAME = 'USDA FoodData Central'

/** Data provenance shown to users, e.g. "USDA FoodData Central · SR Legacy #171477". */
export function usdaAttribution(dataType: UsdaDataType, fdcId: string): string {
  return `${USDA_SOURCE_NAME} · ${FDC_DATA_TYPE_NAMES[dataType]} #${fdcId}`
}

/** FDC `dataType` string → our key; unsupported types (e.g. "Experimental") → null. */
export function toUsdaDataType(raw: string | null): UsdaDataType | null {
  return USDA_DATA_TYPES.find((type) => FDC_DATA_TYPE_NAMES[type] === raw) ?? null
}

function brandOf(food: UnknownRecord, dataType: UsdaDataType): string | null {
  if (dataType !== 'branded') return null
  const brand = readString(food, 'brandName') ?? readString(food, 'brandOwner')
  return brand === null ? null : truncate(sensibleCase(brand), USDA_LIMITS.brandMax)
}

function servingsOf(food: UnknownRecord): UsdaServingDto[] {
  const branded = brandedServing(food)
  return finalizeServings([
    ...(branded ? [branded] : []),
    ...portionServings(readArray(food, 'foodPortions')),
    ...measureServings(readArray(food, 'foodMeasures')),
  ])
}

/**
 * Normalizes one FDC food from a search result OR a `format=full` / `format=abridged` detail.
 * Returns null for items without an id, a supported data type, a name, or any of calories/protein/carbs/fat.
 */
export function normalizeUsdaFood(raw: unknown): UsdaFoodDto | null {
  if (!isRecord(raw)) return null
  const fdcId = readNumber(raw, 'fdcId')
  if (fdcId === null || !Number.isInteger(fdcId) || fdcId <= 0) return null
  const dataType = toUsdaDataType(readString(raw, 'dataType'))
  if (dataType === null) return null
  const description = readString(raw, 'description')
  if (description === null) return null
  const per100g = mapFdcNutrients(readNutrientRows(readArray(raw, 'foodNutrients')))
  if (!hasCoreNutrient(per100g)) return null
  const externalId = String(fdcId)
  return {
    externalId,
    name: truncate(sensibleCase(description), USDA_LIMITS.nameMax),
    brand: brandOf(raw, dataType),
    barcode: dataType === 'branded' ? normalizeGtin(readString(raw, 'gtinUpc')) : null,
    dataType,
    per100g,
    servings: servingsOf(raw),
    attribution: usdaAttribution(dataType, externalId),
  }
}

function nonNegativeInteger(source: UnknownRecord, key: string): number {
  const value = readNumber(source, key)
  return value !== null && value >= 0 ? Math.floor(value) : 0
}

/**
 * Normalizes a `/v1/foods/search` response. Returns null when the envelope is malformed
 * (the Edge Function answers 502 `upstream_error`). Unusable foods are dropped.
 */
export function normalizeUsdaSearchResponse(
  raw: unknown,
  request: { page: number; pageSize: number },
): UsdaSearchResponseDto | null {
  if (!isRecord(raw) || !Array.isArray(raw.foods)) return null
  const foods: UsdaFoodDto[] = []
  for (const item of raw.foods) {
    const food = normalizeUsdaFood(item)
    if (food !== null) foods.push(food)
  }
  return {
    page: request.page,
    pageSize: request.pageSize,
    totalHits: nonNegativeInteger(raw, 'totalHits'),
    totalPages: nonNegativeInteger(raw, 'totalPages'),
    foods,
  }
}

/**
 * Normalizes a `/v1/food/{fdcId}?format=full` response into the `food` action body.
 * Returns null when the food is unusable (no name / no core nutrient / unsupported type);
 * the Edge Function answers 404 `not_found` in that case.
 */
export function normalizeUsdaFoodResponse(raw: unknown): UsdaFoodResponseDto | null {
  const food = normalizeUsdaFood(raw)
  return food === null ? null : { food }
}

export * from './types.ts'
export { FDC_NUTRIENT_NUMBERS } from './nutrients.ts'
