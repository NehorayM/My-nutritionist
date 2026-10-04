/**
 * Shape of `system-foods.json`, the canonical system food catalog.
 *
 * Node-safe module: it is also loaded by `scripts/generate-seed-sql.ts` under plain Node (type stripping) and
 * type-checked with tsconfig.node.json, so it uses relative `.ts` imports and only depends on contract files
 * that have no imports of their own. Contract enumerations (categories, allergens, meal types) are narrowed
 * by the app-facing loader in `systemFoods.ts`; the database re-checks them with CHECK constraints.
 */
import { z } from 'zod'
import { NUTRIENT_KEYS } from '../types/nutrition.ts'

export const USDA_DATA_TYPES = ['foundation', 'sr_legacy', 'survey_fndds'] as const
export type UsdaDataType = (typeof USDA_DATA_TYPES)[number]

/** exact = the USDA record is this food · close = minor variant · proxy = closest comparable dish. */
export const USDA_MATCH_LEVELS = ['exact', 'close', 'proxy'] as const
export type UsdaMatchLevel = (typeof USDA_MATCH_LEVELS)[number]

/** Lowercase snake_case; doubles as `food_items.external_id` (1–64 chars). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

const nonEmpty = z.string().trim().min(1)
/** null = USDA reports no value (unknown); numbers are finite and never negative. */
const nutrientAmount = z.number().nonnegative().nullable()

export const usdaProvenanceSchema = z.strictObject({
  fdcId: z.number().int().positive(),
  dataType: z.enum(USDA_DATA_TYPES),
  /** USDA's own description of the record the values come from. */
  description: nonEmpty,
  match: z.enum(USDA_MATCH_LEVELS),
  note: nonEmpty.optional(),
})
export type UsdaProvenance = z.infer<typeof usdaProvenanceSchema>

export const systemFoodRecordSchema = z.strictObject({
  id: z.uuid(),
  slug: z.string().max(64).regex(SLUG_PATTERN),
  name: nonEmpty.max(200),
  category: nonEmpty,
  tags: z.array(nonEmpty).max(30),
  usda: usdaProvenanceSchema,
  /** Exhaustive: every NutrientKey must be present, unknown keys are rejected. */
  per100g: z.record(z.enum(NUTRIENT_KEYS), nutrientAmount),
  /** Bounds mirror meal_logs.serving_label / serving_grams so any serving can be logged. */
  servings: z.array(z.strictObject({ label: nonEmpty.max(80), grams: z.number().positive().max(5000) })).max(20),
  /** null = allergen information unknown. */
  allergens: z.array(nonEmpty).nullable(),
  dietFlags: z.strictObject({ vegetarian: z.boolean().nullable(), vegan: z.boolean().nullable() }),
  prepMinutes: z.number().int().min(0).max(600).nullable(),
  requiresCooking: z.boolean().nullable(),
  costTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  mealTypes: z.array(nonEmpty).max(10),
})
export type SystemFoodRecord = z.infer<typeof systemFoodRecordSchema>

function findDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return undefined
}

export const systemFoodCatalogSchema = z.strictObject({
  /** Documentation fields are kept free-form; only the release instant is used by code. */
  meta: z.looseObject({
    /** UTC instant stamped on every system food (createdAt/updatedAt). Must not be in the future. */
    releasedAt: z.iso.datetime(),
    source: nonEmpty,
    license: nonEmpty,
  }),
  foods: z
    .array(systemFoodRecordSchema)
    .min(1)
    .superRefine((foods, ctx) => {
      const duplicateSlug = findDuplicate(foods.map((food) => food.slug))
      if (duplicateSlug !== undefined) ctx.addIssue({ code: 'custom', message: `Duplicate slug "${duplicateSlug}"` })
      const duplicateId = findDuplicate(foods.map((food) => food.id))
      if (duplicateId !== undefined) ctx.addIssue({ code: 'custom', message: `Duplicate id "${duplicateId}"` })
    }),
})
export type SystemFoodCatalog = z.infer<typeof systemFoodCatalogSchema>
