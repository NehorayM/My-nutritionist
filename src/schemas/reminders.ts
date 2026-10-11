import { z } from 'zod'
import { DISPATCH_STATUSES, MEAL_TYPES, REMINDER_KINDS } from '@/types'
import { COUNT_LIMITS } from './limits'
import { boundedText, dateKeySchema, isoTimestampSchema, uuidSchema } from './primitives'

/** "HH:MM" 24-hour local time; "HH:MM:SS" from Postgres `time` is accepted and shortened. */
export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, { message: 'Use a time like 08:30' })
  .transform((value) => value.slice(0, 5))

/** Weekdays 0 (Sunday) … 6 (Saturday): unique and sorted. */
export const weekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(COUNT_LIMITS.reminderDays.min)
  .max(COUNT_LIMITS.reminderDays.max)
  .refine((days) => new Set(days).size === days.length, { message: 'Each day once' })
  .transform((days) => [...days].sort((a, b) => a - b))

/** True for IANA time zone names this runtime knows (the database checks pg_timezone_names too). */
export function isTimeZone(value: string): boolean {
  try {
    return value.length > 0 && Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone.length > 0
  } catch {
    return false
  }
}

export const reminderScheduleSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    kind: z.enum(REMINDER_KINDS),
    mealType: z.enum(MEAL_TYPES).nullable(),
    localTime: localTimeSchema,
    days: weekdaysSchema,
    timezone: boundedText(1, 64).refine(isTimeZone, { message: 'Unknown time zone' }),
    enabled: z.boolean(),
    skipIfLogged: z.boolean(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .refine((schedule) => (schedule.kind === 'meal_log') === (schedule.mealType !== null), {
    message: 'Meal reminders name a meal; other reminders do not',
    path: ['mealType'],
  })

export const reminderDispatchSchema = z.object({
  id: uuidSchema,
  scheduleId: uuidSchema,
  localDate: dateKeySchema,
  dueAt: isoTimestampSchema,
  status: z.enum(DISPATCH_STATUSES),
  detail: boundedText(0, 200).nullable(),
  updatedAt: isoTimestampSchema,
})
