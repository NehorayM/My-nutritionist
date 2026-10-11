import type { MealType } from './meal'

/** Email reminder topics. */
export const REMINDER_KINDS = ['meal_log', 'hydration', 'planning', 'weigh_in'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]

/** One email reminder: what, when (local time and weekdays in `timezone`). Signed-in users only. */
export interface ReminderSchedule {
  id: string
  userId: string
  kind: ReminderKind
  /** The meal to log; set exactly for 'meal_log'. */
  mealType: MealType | null
  /** Local time "HH:MM" (24 h). */
  localTime: string
  /** Weekdays in the schedule's time zone, 0 = Sunday … 6 = Saturday (sorted, unique). */
  days: number[]
  /** IANA time zone, e.g. "Asia/Jerusalem". */
  timezone: string
  enabled: boolean
  /** Meal reminders only: no email when that meal is already logged that day. */
  skipIfLogged: boolean
  createdAt: string
  updatedAt: string
}

export const DISPATCH_STATUSES = ['pending', 'claimed', 'sent', 'skipped', 'failed'] as const
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

/** Server-side delivery record of a reminder for one local day (read-only for the user). */
export interface ReminderDispatch {
  id: string
  scheduleId: string
  localDate: string
  dueAt: string
  status: DispatchStatus
  detail: string | null
  updatedAt: string
}
