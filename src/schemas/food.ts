import { z } from 'zod'
import { ALLERGENS, FOOD_CATEGORIES, FOOD_SOURCES, MEAL_TYPES, type MealType } from '@/types'
import { BARCODE_PATTERN, COUNT_LIMITS, LIMITS, TEXT_LIMITS } from './limits'
import { nutrientsPer100gSchema } from './nutrition'
import { boundedText, intInRange, isoTimestampSchema, positiveUpTo, uuidSchema } from './primitives'

export const servingOptionSchema = z.object({
  label: boundedText(1, TEXT_LIMITS.servingLabel),
  grams: positiveUpTo(LIMITS.servingGrams.max),
})

export const dietFlagsSchema = z.object({
  vegetarian: z.boolean().nullable(),
  vegan: z.boolean().nullable(),
})

function isMealType(value: string): value is MealType {
  return (MEAL_TYPES as readonly string[]).includes(value)
}

/**
 * Meal slots a food suits. The column is free text (slots may become customizable), so slot
 * names this app version does not know are ignored instead of rejecting the whole food.
 */
const foodMealTypesSchema = z
  .array(z.string())
  .max(COUNT_LIMITS.foodMealTypes)
  .transform((values) => values.filter(isMealType))

export const foodItemSchema = z
  .object({
    id: uuidSchema,
    source: z.enum(FOOD_SOURCES),
    externalId: boundedText(1, TEXT_LIMITS.externalId).nullable(),
    name: boundedText(1, TEXT_LIMITS.foodName),
    brand: boundedText(0, TEXT_LIMITS.brand).nullable(),
    barcode: z.string().regex(BARCODE_PATTERN, { message: 'Barcode must be 6–14 digits' }).nullable(),
    category: z.enum(FOOD_CATEGORIES).nullable(),
    per100g: nutrientsPer100gSchema,
    servings: z.array(servingOptionSchema).max(COUNT_LIMITS.servings),
    allergens: z.array(z.enum(ALLERGENS)).nullable(),
    dietFlags: dietFlagsSchema,
    tags: z.array(boundedText(1, TEXT_LIMITS.foodTag)).max(COUNT_LIMITS.foodTags),
    mealTypes: foodMealTypesSchema,
    prepMinutes: intInRange(LIMITS.foodPrepMinutes).nullable(),
    requiresCooking: z.boolean().nullable(),
    costTier: z.literal([1, 2, 3]).nullable(),
    attribution: boundedText(0, TEXT_LIMITS.attribution).nullable(),
    createdBy: uuidSchema.nullable(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .refine((food) => (food.source === 'system') === (food.createdBy === null), {
    message: 'System foods have no owner and every other food has one',
    path: ['createdBy'],
  })
