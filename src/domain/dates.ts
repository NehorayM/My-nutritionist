/**
 * Local calendar dates are represented as "date keys" (YYYY-MM-DD) in the user's
 * timezone. Arithmetic on keys is done in UTC so DST transitions never shift a day.
 */
export type DateKey = string

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function parts(key: DateKey): [number, number, number] {
  const match = DATE_KEY_PATTERN.exec(key)
  if (!match) throw new RangeError(`Invalid date key: ${key}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** True for a well-formed key that names a real calendar date. */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Local calendar date of an instant, in the runtime's timezone. */
export function toDateKey(date: Date): DateKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now)
}

function toUtcMs(key: DateKey): number {
  const [y, m, d] = parts(key)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): DateKey {
  const date = new Date(ms)
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcMs(toUtcMs(key) + days * MS_PER_DAY)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY)
}

/** Day of week, 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: DateKey): number {
  return new Date(toUtcMs(key)).getUTCDay()
}

/** First day of the week containing `key`. */
export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const offset = (weekdayOf(key) - weekStartsOn + 7) % 7
  return addDays(key, -offset)
}

/** Inclusive list of keys from `from` to `to`; empty when `to` is before `from`. */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const count = daysBetween(from, to)
  const days: DateKey[] = []
  for (let i = 0; i <= count; i += 1) days.push(addDays(from, i))
  return days
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Completed years between a birth date and a reference date. */
export function ageOn(birthDate: DateKey, on: DateKey): number {
  const [by, bm, bd] = parts(birthDate)
  const [y, m, d] = parts(on)
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age -= 1
  return age
}

/** Local midnight Date for a key (for display formatting only). */
export function dateKeyToLocalDate(key: DateKey): Date {
  const [y, m, d] = parts(key)
  return new Date(y, m - 1, d)
}

/** Minutes since local midnight. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}
