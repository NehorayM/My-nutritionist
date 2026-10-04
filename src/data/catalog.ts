/**
 * Validated system food catalog (USDA FoodData Central sourced) as plain rows.
 *
 * Node-safe (see catalogSchema.ts): shared by the app-facing loader `systemFoods.ts` and by
 * `scripts/generate-seed-sql.ts`, so the bundled catalog and the `food_items` seed can never disagree.
 */
import catalogJson from './system-foods.json' with { type: 'json' }
import {
  systemFoodCatalogSchema,
  type SystemFoodCatalog,
  type SystemFoodRecord,
  type UsdaDataType,
  type UsdaProvenance,
} from './catalogSchema.ts'
import type { FoodRow } from './foodRow.ts'

/** A catalog food as a `FoodItem`-shaped row; enumerations are still plain strings (narrowed in systemFoods.ts). */
export type SystemFoodRow = FoodRow & {
  readonly source: 'system'
  readonly externalId: string
  readonly brand: null
  readonly barcode: null
  readonly category: string
  readonly costTier: SystemFoodRecord['costTier']
  readonly attribution: string
  readonly createdBy: null
}

const DATASET_LABELS: Record<UsdaDataType, string> = {
  foundation: 'Foundation',
  sr_legacy: 'SR Legacy',
  survey_fndds: 'FNDDS',
}

/** User-facing provenance line, e.g. "USDA FoodData Central · SR Legacy #171477". */
export function usdaAttribution(usda: Pick<UsdaProvenance, 'dataType' | 'fdcId'>): string {
  return `USDA FoodData Central · ${DATASET_LABELS[usda.dataType]} #${usda.fdcId}`
}

/** Maps a catalog record to a row: source "system", slug as external id, no owner, release timestamps. */
export function toFoodRow(record: SystemFoodRecord, releasedAt: string): SystemFoodRow {
  return {
    id: record.id,
    source: 'system',
    externalId: record.slug,
    name: record.name,
    brand: null,
    barcode: null,
    category: record.category,
    per100g: { ...record.per100g },
    servings: record.servings.map((serving) => ({ label: serving.label, grams: serving.grams })),
    allergens: record.allergens === null ? null : [...record.allergens],
    dietFlags: { vegetarian: record.dietFlags.vegetarian, vegan: record.dietFlags.vegan },
    tags: [...record.tags],
    mealTypes: [...record.mealTypes],
    prepMinutes: record.prepMinutes,
    requiresCooking: record.requiresCooking,
    costTier: record.costTier,
    attribution: usdaAttribution(record.usda),
    createdBy: null,
    createdAt: releasedAt,
    updatedAt: releasedAt,
  }
}

/** Parsed once at module load; an invalid committed catalog fails fast with a descriptive ZodError. */
export const SYSTEM_FOOD_CATALOG: SystemFoodCatalog = systemFoodCatalogSchema.parse(catalogJson)

/** Fixed release instant used as createdAt/updatedAt of every system food (app and database). */
export const SYSTEM_FOODS_RELEASED_AT: string = SYSTEM_FOOD_CATALOG.meta.releasedAt

/** Catalog records in file order, with full USDA provenance (fdcId, data type, description, match, note). */
export const SYSTEM_FOOD_RECORDS: readonly SystemFoodRecord[] = SYSTEM_FOOD_CATALOG.foods

export const SYSTEM_FOOD_ROWS: readonly SystemFoodRow[] = SYSTEM_FOOD_RECORDS.map((record) =>
  toFoodRow(record, SYSTEM_FOODS_RELEASED_AT),
)
