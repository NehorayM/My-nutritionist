import { z } from 'zod'
import { NUTRIENT_KEYS, type NutrientKey } from '@/types'
import { FOOD_TEXT_LIMITS, USDA_DATA_TYPES, type UsdaFoodDto } from './shared'

/**
 * Zod schemas for the `food-search` Edge Function responses (docs/contracts/food-search-function.md).
 * The client trusts nothing: values outside the contract fail validation (→ 'invalid_response').
 */
const nutrientValue = z.number().nonnegative().max(100_000).nullable().optional().transform((value) => value ?? null)

const per100gSchema = z
  .object(Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, nutrientValue])) as Record<NutrientKey, typeof nutrientValue>)
  .refine((profile) => profile.calories === null || profile.calories <= 1000, 'calories per 100 g out of range')

const servingSchema = z.object({
  label: z.string().trim().min(1).max(FOOD_TEXT_LIMITS.servingLabelMax),
  grams: z.number().positive().max(100_000),
})

export const usdaFoodDtoSchema = z.object({
  externalId: z.string().regex(/^\d{1,20}$/),
  name: z.string().trim().min(1).max(FOOD_TEXT_LIMITS.nameMax),
  brand: z.string().max(FOOD_TEXT_LIMITS.brandMax).nullable(),
  barcode: z
    .string()
    .regex(/^\d{6,14}$/)
    .nullable(),
  dataType: z.enum(USDA_DATA_TYPES),
  per100g: per100gSchema,
  servings: z.array(servingSchema).max(FOOD_TEXT_LIMITS.servingsMax),
  attribution: z.string().min(1).max(300),
})

/** Search envelope; foods are validated one by one so one bad item does not hide the rest. */
export const usdaSearchEnvelopeSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalHits: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  foods: z.array(z.unknown()),
})

export const usdaFoodEnvelopeSchema = z.object({ food: z.unknown() })

export const usdaErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string().optional() }),
})

type ParsedUsdaFood = z.infer<typeof usdaFoodDtoSchema>

/** Compile-time guard: the schema output must stay assignable to the shared contract type. */
export type CheckedUsdaFoodDto = ParsedUsdaFood extends UsdaFoodDto ? ParsedUsdaFood : never

export function parseUsdaFoodDto(value: unknown): CheckedUsdaFoodDto | null {
  const result = usdaFoodDtoSchema.safeParse(value)
  return result.success ? result.data : null
}
