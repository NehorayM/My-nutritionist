import { compareDateKeys, isDateKey, toDateKey } from '@/domain/dates'
import { TEXT_LIMITS } from '@/schemas/limits'
import type { UnitSystem, WeightEntry, WeightUnit } from '@/types'
import { inputValueToKg, kgToInputValue, weightError, weightUnitFor } from './weightUnits'

/** What the weigh-in form holds while the user edits it. */
export interface WeighInDraft {
  /** In the user's unit (kg or lb). */
  weight: number | null
  /** Local date key YYYY-MM-DD. */
  date: string
  /** Local clock time HH:MM. */
  time: string
  note: string
}

export type WeighInField = keyof WeighInDraft
export type WeighInErrors = Partial<Record<WeighInField, string>>

export interface WeighInValues {
  weightKg: number
  inputUnit: WeightUnit
  date: string
  measuredAt: string
  note: string | null
}

export type WeighInValidation = { ok: true; values: WeighInValues } | { ok: false; errors: WeighInErrors }

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
/** A weigh-in may be stamped up to a minute ahead (clock drift between typing and saving). */
const FUTURE_TOLERANCE_MS = 60_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local clock time "HH:MM" of an instant. */
export function toTimeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** ISO instant for a local date key + "HH:MM", or null when either part is invalid. */
export function localDateTimeToIso(date: string, time: string): string | null {
  const match = TIME_PATTERN.exec(time)
  if (!isDateKey(date) || !match) return null
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day, Number(match[1]), Number(match[2])).toISOString()
}

/** A fresh draft for a new weigh-in at `now`. */
export function newWeighInDraft(now: Date): WeighInDraft {
  return { weight: null, date: toDateKey(now), time: toTimeValue(now), note: '' }
}

/** A draft prefilled from a stored entry, shown in the user's unit. */
export function draftFromEntry(entry: WeightEntry, unitSystem: UnitSystem): WeighInDraft {
  const measured = new Date(entry.measuredAt)
  return {
    weight: kgToInputValue(entry.weightKg, weightUnitFor(unitSystem)),
    date: entry.date,
    time: Number.isNaN(measured.getTime()) ? '' : toTimeValue(measured),
    note: entry.note ?? '',
  }
}

function noteLength(note: string): number {
  return [...note].length
}

interface ValidateOptions {
  unitSystem: UnitSystem
  now: Date
  /** When editing: the stored kg value, kept as-is if the shown weight was not changed. */
  original?: { weight: number | null; weightKg: number; inputUnit: WeightUnit }
}

/** Checks a draft and converts it to storable values (kg, ISO timestamp, trimmed note). */
export function validateWeighIn(draft: WeighInDraft, { unitSystem, now, original }: ValidateOptions): WeighInValidation {
  const unit = weightUnitFor(unitSystem)
  const errors: WeighInErrors = {}

  const weightMessage = weightError(draft.weight, unit, 'Enter your weight.')
  if (weightMessage) errors.weight = weightMessage

  const today = toDateKey(now)
  if (!isDateKey(draft.date)) errors.date = 'Choose a date.'
  else if (compareDateKeys(draft.date, today) > 0) errors.date = 'Choose today or an earlier date.'

  const measuredAt = localDateTimeToIso(draft.date, draft.time)
  if (!TIME_PATTERN.test(draft.time)) errors.time = 'Enter a time.'
  else if (!errors.date && measuredAt && Date.parse(measuredAt) > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.time = 'Choose a time up to now.'
  }

  const note = draft.note.trim()
  if (noteLength(note) > TEXT_LIMITS.weightNote) {
    errors.note = `Keep the note to ${TEXT_LIMITS.weightNote} characters or fewer.`
  }

  if (Object.keys(errors).length > 0 || draft.weight === null || !measuredAt) return { ok: false, errors }

  const unchanged = original !== undefined && original.weight === draft.weight
  return {
    ok: true,
    values: {
      weightKg: unchanged ? original.weightKg : inputValueToKg(draft.weight, unit),
      inputUnit: unchanged ? original.inputUnit : unit,
      date: draft.date,
      measuredAt,
      note: note === '' ? null : note,
    },
  }
}
