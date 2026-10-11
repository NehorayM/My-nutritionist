import { z } from 'zod'
import { KITCHEN_EQUIPMENT, MEAL_TYPES, PANTRY_PREP, type KitchenEquipment } from '@/types'
import { foodSnapshotSchema } from './food'
import { LIMITS, TEXT_LIMITS } from './limits'
import { boundedText, dateKeySchema, intInRange, isoTimestampSchema, positiveUpTo, uuidSchema } from './primitives'

/** Equipment lists are sets: duplicates are dropped and the order is canonical. */
const equipmentListSchema = z
  .array(z.enum(KITCHEN_EQUIPMENT))
  .max(KITCHEN_EQUIPMENT.length)
  .transform((values) => KITCHEN_EQUIPMENT.filter((item) => values.includes(item)) as KitchenEquipment[])

export const pantryItemSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    food: foodSnapshotSchema,
    grams: positiveUpTo(LIMITS.pantryGrams.max).nullable(),
    servingLabel: boundedText(0, TEXT_LIMITS.servingLabel).nullable(),
    servingGrams: positiveUpTo(LIMITS.servingGrams.max).nullable(),
    prep: z.enum(PANTRY_PREP),
    cookMinutes: intInRange(LIMITS.cookMinutes).nullable(),
    methods: equipmentListSchema,
    useBy: dateKeySchema.nullable(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .refine((item) => (item.prep === 'cook') === (item.cookMinutes !== null), {
    message: 'Cooking time is set exactly for items cooked from raw',
    path: ['cookMinutes'],
  })
  .refine((item) => item.prep === 'ready' || item.methods.length > 0, {
    message: 'Pick how it can be warmed or cooked',
    path: ['methods'],
  })

const kcalSchema = intInRange(LIMITS.mealKcal).nullable()

export const mealConstraintSchema = z
  .object({
    enabled: z.boolean(),
    equipment: equipmentListSchema,
    canCook: z.boolean(),
    maxMinutes: intInRange(LIMITS.mealMinutes),
    kcalMin: kcalSchema,
    kcalMax: kcalSchema,
  })
  .refine((meal) => meal.kcalMin === null || meal.kcalMax === null || meal.kcalMin <= meal.kcalMax, {
    message: 'The lower calorie limit must not be above the upper one',
    path: ['kcalMax'],
  })

const dailyKcalSchema = intInRange(LIMITS.dailyKcal).nullable()

export const plannerSettingsSchema = z
  .object({
    userId: uuidSchema,
    equipmentScope: z.enum(['day', 'meal']),
    dayEquipment: equipmentListSchema,
    dailyKcalMin: dailyKcalSchema,
    dailyKcalMax: dailyKcalSchema,
    meals: z.object(Object.fromEntries(MEAL_TYPES.map((meal) => [meal, mealConstraintSchema])) as Record<(typeof MEAL_TYPES)[number], typeof mealConstraintSchema>),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .refine((settings) => settings.dailyKcalMin === null || settings.dailyKcalMax === null || settings.dailyKcalMin <= settings.dailyKcalMax, {
    message: 'The lower daily limit must not be above the upper one',
    path: ['dailyKcalMax'],
  })
