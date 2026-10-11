import { mealLabel } from '@/domain/meals'
import type { DispatchStatus, ReminderDispatch, ReminderKind, ReminderSchedule } from '@/types'

export const KIND_LABELS: Record<ReminderKind, string> = {
  meal_log: 'Log a meal',
  hydration: 'Drink water',
  planning: 'Plan meals',
  weigh_in: 'Weigh-in',
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

export function reminderTitle(schedule: Pick<ReminderSchedule, 'kind' | 'mealType'>): string {
  return schedule.kind === 'meal_log' && schedule.mealType ? `Log ${mealLabel(schedule.mealType).toLowerCase()}` : KIND_LABELS[schedule.kind]
}

/** "Every day", "Weekdays", "Weekends" or "Sun, Tue, Thu". */
export function daysText(days: readonly number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Mon–Fri'
  if (set.size === 5 && [0, 1, 2, 3, 4].every((d) => set.has(d))) return 'Sun–Thu'
  if (set.size === 2 && set.has(5) && set.has(6)) return 'Fri & Sat'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ')
}

const DETAIL_TEXT: Readonly<Record<string, string>> = {
  already_logged: 'skipped — already logged',
  email_not_configured: 'not sent — email delivery isn’t set up on the server yet',
  provider_rejected: 'not sent — the email service refused it',
  provider_unavailable: 'will retry — the email service was busy',
  no_email: 'not sent — no email address',
}

const STATUS_TEXT: Record<DispatchStatus, string> = {
  pending: 'waiting',
  claimed: 'sending…',
  sent: 'sent',
  skipped: 'skipped',
  failed: 'will retry',
}

export function deliveryText(dispatch: Pick<ReminderDispatch, 'status' | 'detail'>): string {
  return (dispatch.detail ? DETAIL_TEXT[dispatch.detail] : undefined) ?? STATUS_TEXT[dispatch.status]
}

/** The device's time zone (IANA), e.g. "Asia/Jerusalem"; UTC when unknown. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Time zones for the picker (the device's first). */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  return [...new Set([current, deviceTimeZone(), 'UTC', ...zones])]
}
