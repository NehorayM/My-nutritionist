import { addDays, dateKeyToLocalDate, isDateKey, type DateKey } from '@/domain/dates'
import { NUTRIENTS } from '@/domain/nutrients'
import { cmToFeetInches, kgToLb } from '@/domain/units'
import type { NutrientKey, UnitSystem } from '@/types'

/**
 * Display formatting (en-US). Pure presentation helpers: no calculations beyond unit conversion
 * and rounding. Unknown values (`null`) always render as an em dash, never as 0.
 */
export const UNKNOWN_VALUE = '—'
const LOCALE = 'en-US'
/** True minus sign (U+2212) for signed deltas: reads correctly in screen readers and aligns with digits. */
const MINUS = '−'

const numberFormats = new Map<number, Intl.NumberFormat>()

function numberFormat(decimals: number): Intl.NumberFormat {
  let format = numberFormats.get(decimals)
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    numberFormats.set(decimals, format)
  }
  return format
}

function isKnown(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Rounded number with grouping ("1,250", "2.5"). Negative zero is shown as 0. */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (!isKnown(value)) return UNKNOWN_VALUE
  const text = numberFormat(decimals).format(value)
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text
}

interface UnitOptions {
  /** Append the unit ("12 g"). Default true. */
  unit?: boolean
}

function withUnit(text: string, unit: string, options?: UnitOptions): string {
  return options?.unit === false ? text : `${text} ${unit}`
}

/**
 * A nutrient amount using its metadata (unit + decimals). Positive amounts that round to zero
 * are shown as "<1 g" / "<0.1 mg" so trace amounts are not presented as none.
 */
export function formatNutrient(key: NutrientKey, value: number | null | undefined, options?: UnitOptions): string {
  if (!isKnown(value)) return UNKNOWN_VALUE
  const meta = NUTRIENTS[key]
  const smallest = 10 ** -meta.decimals
  if (value > 0 && value < smallest / 2) {
    return withUnit(`<${formatNumber(smallest, meta.decimals)}`, meta.unit, options)
  }
  return withUnit(formatNumber(value, meta.decimals), meta.unit, options)
}

export function formatKcal(value: number | null | undefined, options?: UnitOptions): string {
  return formatNutrient('calories', value, options)
}

export function formatGrams(value: number | null | undefined, decimals = 0, options?: UnitOptions): string {
  if (!isKnown(value)) return UNKNOWN_VALUE
  return withUnit(formatNumber(value, decimals), 'g', options)
}

function weightIn(unitSystem: UnitSystem, kg: number): { amount: number; unit: string } {
  return unitSystem === 'imperial' ? { amount: kgToLb(kg), unit: 'lb' } : { amount: kg, unit: 'kg' }
}

/** Body weight stored in kg, shown in the user's unit system ("72.4 kg", "159.6 lb"). */
export function formatWeight(
  kg: number | null | undefined,
  unitSystem: UnitSystem,
  decimals = 1,
  options?: UnitOptions,
): string {
  if (!isKnown(kg)) return UNKNOWN_VALUE
  const { amount, unit } = weightIn(unitSystem, kg)
  return withUnit(formatNumber(amount, decimals), unit, options)
}

/**
 * Signed weight change ("+0.4 kg", "−0.3 kg", "0.0 kg"). Purely descriptive: no direction is
 * framed as good or bad here.
 */
export function formatWeightDelta(
  kgDelta: number | null | undefined,
  unitSystem: UnitSystem,
  decimals = 1,
  options?: UnitOptions,
): string {
  if (!isKnown(kgDelta)) return UNKNOWN_VALUE
  const { amount, unit } = weightIn(unitSystem, kgDelta)
  const magnitude = formatNumber(Math.abs(amount), decimals)
  const roundsToZero = Number(magnitude.replace(/,/g, '')) === 0
  const sign = roundsToZero ? '' : amount > 0 ? '+' : MINUS
  return withUnit(`${sign}${magnitude}`, unit, options)
}

/** Height stored in cm ("178 cm", "5 ft 10 in"). */
export function formatHeight(cm: number | null | undefined, unitSystem: UnitSystem): string {
  if (!isKnown(cm)) return UNKNOWN_VALUE
  if (unitSystem === 'metric') return `${formatNumber(cm, 0)} cm`
  const { feet, inches } = cmToFeetInches(cm)
  return `${feet} ft ${inches} in`
}

const shortDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' })
const shortDateWithYear = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const longDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const timeOfDay = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' })

/**
 * Relative label for a local date: "Today", "Yesterday", "Tomorrow", otherwise "Sat, Oct 3"
 * (with the year when it differs from today's year).
 */
export function formatDateLabel(dateKey: DateKey, today: DateKey): string {
  if (!isDateKey(dateKey)) return UNKNOWN_VALUE
  if (isDateKey(today)) {
    if (dateKey === today) return 'Today'
    if (dateKey === addDays(today, -1)) return 'Yesterday'
    if (dateKey === addDays(today, 1)) return 'Tomorrow'
  }
  const sameYear = isDateKey(today) && dateKey.slice(0, 4) === today.slice(0, 4)
  return (sameYear ? shortDate : shortDateWithYear).format(dateKeyToLocalDate(dateKey))
}

/** "Saturday, October 3, 2026". */
export function formatLongDate(dateKey: DateKey): string {
  if (!isDateKey(dateKey)) return UNKNOWN_VALUE
  return longDate.format(dateKeyToLocalDate(dateKey))
}

/** Local clock time of an ISO timestamp ("8:05 AM"). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return UNKNOWN_VALUE
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? UNKNOWN_VALUE : timeOfDay.format(date)
}

/** Whole-minute duration: "45 min", "1 h 15 min", "2 h". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!isKnown(minutes) || minutes < 0) return UNKNOWN_VALUE
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** Ratio as a whole percentage (0.853 → "85%"). Ratios above 1 are shown as-is ("120%"). */
export function formatPercent(ratio: number | null | undefined, decimals = 0): string {
  if (!isKnown(ratio)) return UNKNOWN_VALUE
  return `${formatNumber(ratio * 100, decimals)}%`
}
