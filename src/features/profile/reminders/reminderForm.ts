import type { ReminderInput } from '@/stores/remindersStore'
import type { MealType, ReminderKind, ReminderSchedule } from '@/types'
import { deviceTimeZone } from './labels'

export const DEFAULT_TIMES: Record<ReminderKind, string> = { meal_log: '13:00', hydration: '10:30', planning: '20:00', weigh_in: '07:30' }
const MEAL_TIMES: Record<MealType, string> = { breakfast: '08:30', lunch: '13:00', dinner: '19:30', snack: '16:30' }

export function newReminderInput(kind: ReminderKind = 'meal_log', mealType: MealType = 'lunch'): ReminderInput {
  return {
    kind,
    mealType: kind === 'meal_log' ? mealType : null,
    localTime: kind === 'meal_log' ? MEAL_TIMES[mealType] : DEFAULT_TIMES[kind],
    days: [0, 1, 2, 3, 4, 5, 6],
    timezone: deviceTimeZone(),
    enabled: true,
    skipIfLogged: true,
  }
}

export function inputOf(schedule: ReminderSchedule): ReminderInput {
  const { kind, mealType, localTime, days, timezone, enabled, skipIfLogged } = schedule
  return { kind, mealType, localTime, days, timezone, enabled, skipIfLogged }
}

/** A friendly starting set: the three main meals and an evening planning nudge. */
export function suggestedReminders(): ReminderInput[] {
  return [
    newReminderInput('meal_log', 'breakfast'),
    newReminderInput('meal_log', 'lunch'),
    newReminderInput('meal_log', 'dinner'),
    { ...newReminderInput('planning'), days: [0, 1, 2, 3, 4] },
  ]
}

export function reminderFormError(input: ReminderInput): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.localTime)) return 'Pick a time.'
  if (input.days.length === 0) return 'Pick at least one day.'
  if (input.kind === 'meal_log' && input.mealType === null) return 'Pick a meal.'
  return null
}
