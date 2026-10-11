import type { MealType, ReminderKind, ReminderSchedule } from '@/types'
import { reminderScheduleSchema } from '@/schemas'
import { asRow, parseMapped } from './shared'

/** `public.reminder_schedules` row (005); `local_time` is a Postgres `time` ("HH:MM:SS" when read). */
export interface ReminderScheduleRow {
  id: string
  user_id: string
  kind: ReminderKind
  meal_type: MealType | null
  local_time: string
  days: number[]
  timezone: string
  enabled: boolean
  skip_if_logged: boolean
  created_at: string
  updated_at: string
}

export function reminderScheduleToRow(schedule: ReminderSchedule): ReminderScheduleRow {
  return {
    id: schedule.id,
    user_id: schedule.userId,
    kind: schedule.kind,
    meal_type: schedule.mealType,
    local_time: schedule.localTime,
    days: schedule.days,
    timezone: schedule.timezone,
    enabled: schedule.enabled,
    skip_if_logged: schedule.skipIfLogged,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
  }
}

export function reminderScheduleFromRow(value: unknown): ReminderSchedule | null {
  const row = asRow(value)
  if (!row) return null
  return parseMapped(reminderScheduleSchema, {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    mealType: row.meal_type,
    localTime: row.local_time,
    days: row.days,
    timezone: row.timezone,
    enabled: row.enabled,
    skipIfLogged: row.skip_if_logged,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
