import { z } from 'zod'
import {
  ACTIVITY_LEVELS,
  ALLERGENS,
  COOKING_SKILLS,
  CUISINES,
  DIET_TYPES,
  GOAL_PACES,
  SEXES,
  UNIT_SYSTEMS,
  WELLNESS_GOALS,
} from '@/types'
import { COUNT_LIMITS, LIMITS, TEXT_LIMITS } from './limits'
import { boundedText, dateKeySchema, intInRange, isoTimestampSchema, numberInRange, uuidSchema } from './primitives'

/** Birth date within the range the database accepts. */
export const birthDateSchema = dateKeySchema.refine(
  (value) => value >= LIMITS.birthDate.min && value <= LIMITS.birthDate.max,
  { message: `Birth date must be between ${LIMITS.birthDate.min} and ${LIMITS.birthDate.max}` },
)

export const reminderPreferencesSchema = z.object({
  weighIn: z.boolean(),
  activity: z.boolean(),
})

export const profileSchema = z.object({
  userId: uuidSchema,
  displayName: boundedText(0, TEXT_LIMITS.displayName),
  birthDate: birthDateSchema.nullable(),
  sex: z.enum(SEXES),
  heightCm: numberInRange(LIMITS.heightCm).nullable(),
  currentWeightKg: numberInRange(LIMITS.weightKg).nullable(),
  targetWeightKg: numberInRange(LIMITS.weightKg).nullable(),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(WELLNESS_GOALS),
  goalPace: z.enum(GOAL_PACES),
  dietType: z.enum(DIET_TYPES),
  allergies: z.array(z.enum(ALLERGENS)),
  dislikes: z.array(boundedText(1, TEXT_LIMITS.dislike)).max(COUNT_LIMITS.dislikes),
  preferredCuisines: z.array(z.enum(CUISINES)),
  maxPrepMinutes: intInRange(LIMITS.maxPrepMinutes),
  cookingSkill: z.enum(COOKING_SKILLS),
  strengthSessionsPerWeek: intInRange(LIMITS.sessionsPerWeek),
  cardioSessionsPerWeek: intInRange(LIMITS.sessionsPerWeek),
  preferredWorkoutMinutes: intInRange(LIMITS.preferredWorkoutMinutes),
  unitSystem: z.enum(UNIT_SYSTEMS),
  weekStartsOn: z.literal([0, 1]),
  reminders: reminderPreferencesSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
