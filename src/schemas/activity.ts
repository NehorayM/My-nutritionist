import { z } from 'zod'
import { INTENSITIES, SCHEDULED_STATUSES, WEIGHT_UNITS, WORKOUT_TYPES } from '@/types'
import { LIMITS, TEXT_LIMITS } from './limits'
import { boundedText, dateKeySchema, intInRange, isoTimestampSchema, numberInRange, uuidSchema } from './primitives'

export const weightEntrySchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  date: dateKeySchema,
  measuredAt: isoTimestampSchema,
  weightKg: numberInRange(LIMITS.weightKg),
  inputUnit: z.enum(WEIGHT_UNITS),
  note: boundedText(0, TEXT_LIMITS.weightNote).nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})

export const workoutEntrySchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  date: dateKeySchema,
  type: z.enum(WORKOUT_TYPES),
  durationMin: intInRange(LIMITS.workoutDurationMin),
  intensity: z.enum(INTENSITIES).nullable(),
  estimatedKcal: intInRange(LIMITS.workoutKcal).nullable(),
  kcalSource: z.enum(['user', 'estimate']).nullable(),
  notes: boundedText(0, TEXT_LIMITS.workoutNotes).nullable(),
  scheduledWorkoutId: uuidSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})

export const scheduledWorkoutSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  date: dateKeySchema,
  type: z.enum(WORKOUT_TYPES),
  durationMin: intInRange(LIMITS.workoutDurationMin),
  intensity: z.enum(INTENSITIES).nullable(),
  status: z.enum(SCHEDULED_STATUSES),
  source: z.enum(['catch_up', 'manual']),
  rationale: boundedText(0, TEXT_LIMITS.scheduledRationale).nullable(),
  completedWorkoutId: uuidSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
