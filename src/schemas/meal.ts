import { z } from 'zod'
import { FOOD_SOURCES, MEAL_TYPES } from '@/types'
import { COUNT_LIMITS, LIMITS, TEXT_LIMITS } from './limits'
import { nutrientsPer100gSchema } from './nutrition'
import { boundedText, dateKeySchema, isoTimestampSchema, positiveUpTo, uuidSchema } from './primitives'

/**
 * Portion fields shared by meal entries and saved-meal items. `grams` accepts the storage limit
 * (`LIMITS.entryGrams.storageMax`); forms should apply the stricter `LIMITS.entryGrams.max`.
 */
const foodPortionShape = {
  foodId: uuidSchema.nullable(),
  foodSource: z.enum(FOOD_SOURCES),
  foodExternalId: boundedText(0, TEXT_LIMITS.externalId).nullable(),
  foodName: boundedText(1, TEXT_LIMITS.foodName),
  brand: boundedText(0, TEXT_LIMITS.brand).nullable(),
  quantity: positiveUpTo(LIMITS.entryQuantity.max),
  servingLabel: boundedText(0, TEXT_LIMITS.servingLabel).nullable(),
  servingGrams: positiveUpTo(LIMITS.servingGrams.max).nullable(),
  grams: positiveUpTo(LIMITS.entryGrams.storageMax),
  per100g: nutrientsPer100gSchema,
}

export const foodPortionSchema = z.object(foodPortionShape)

export const mealEntrySchema = z.object({
  ...foodPortionShape,
  id: uuidSchema,
  userId: uuidSchema,
  date: dateKeySchema,
  mealType: z.enum(MEAL_TYPES),
  loggedAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})

export const savedMealSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: boundedText(1, TEXT_LIMITS.savedMealName),
  mealType: z.enum(MEAL_TYPES).nullable(),
  items: z.array(foodPortionSchema).min(COUNT_LIMITS.savedMealItems.min).max(COUNT_LIMITS.savedMealItems.max),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})

export const favoriteSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  foodId: uuidSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
