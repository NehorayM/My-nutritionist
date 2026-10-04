import { dateKeyToLocalDate, weekdayOf } from '@/domain/dates'
import type { WeightChartGranularity, WeightChartPoint, WeightRange } from '@/domain/weight'
import { roundTo } from '@/domain/units'
import { formatDateLabel } from '@/lib/format'
import type { WeightUnit } from '@/types'
import { kgInUnit } from './weightUnits'

/** One chart row in the user's unit (values rounded to 0.01 so tooltips and tables agree). */
export interface ChartDatum {
  date: string
  weight: number | null
  trend: number | null
  target: number | null
}

export const RANGE_LABELS: Record<WeightRange, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time' }

function inUnit(kg: number | null, unit: WeightUnit): number | null {
  return kg === null ? null : roundTo(kgInUnit(kg, unit), 2)
}

/** Engine points (kg) → display rows; rows with nothing to plot are dropped. */
export function toChartData(points: readonly WeightChartPoint[], unit: WeightUnit): ChartDatum[] {
  return points
    .map((point) => ({
      date: point.date,
      weight: inUnit(point.weightKg, unit),
      trend: inUnit(point.trendKg, unit),
      target: inUnit(point.targetKg, unit),
    }))
    .filter((row) => row.weight !== null || row.trend !== null || row.target !== null)
}

export function hasTarget(data: readonly ChartDatum[]): boolean {
  return data.some((row) => row.target !== null)
}

const MAX_TICKS = 6
const ALL_TICKS_UP_TO = 8

/**
 * X-axis ticks: every date for short series; otherwise week starts (per the user's week start) for daily
 * data, or evenly spaced points for weekly data — thinned to at most 6 labels so narrow screens stay legible.
 */
export function chartTicks(dates: readonly string[], granularity: WeightChartGranularity, weekStartsOn: 0 | 1): string[] {
  if (dates.length <= ALL_TICKS_UP_TO) return [...dates]
  const candidates = granularity === 'day' ? dates.filter((date) => weekdayOf(date) === weekStartsOn) : dates
  const step = Math.max(1, Math.ceil(candidates.length / MAX_TICKS))
  return candidates.filter((_, index) => index % step === 0)
}

const NICE_STEPS: readonly number[] = [1, 2, 5, 10, 20, 50, 100]
const LARGEST_STEP = 100
const TARGET_Y_TICKS = 4

export interface YScale {
  domain: [number, number]
  ticks: number[]
}

/** Y range with breathing room, on whole-unit ticks spaced evenly (1, 2, 5, 10 … units). */
export function yScale(data: readonly ChartDatum[]): YScale | null {
  const values = data.flatMap((row) => [row.weight, row.trend, row.target]).filter((v): v is number => v !== null)
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(0.5, (max - min) * 0.1)
  const rawStep = (max - min + 2 * pad) / TARGET_Y_TICKS
  const step = NICE_STEPS.find((candidate) => candidate >= rawStep) ?? LARGEST_STEP
  const low = Math.floor((min - pad) / step) * step
  const high = Math.ceil((max + pad) / step) * step
  const ticks: number[] = []
  for (let tick = low; tick <= high; tick += step) ticks.push(tick)
  return { domain: [low, high], ticks }
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

export function axisDateLabel(date: string, granularity: WeightChartGranularity): string {
  return (granularity === 'week' ? monthFormat : dayFormat).format(dateKeyToLocalDate(date))
}

/** Tooltip/table label: "Today", "Fri, Oct 2", or "Week ending Sun, Oct 4" for weekly points. */
export function pointDateLabel(date: string, granularity: WeightChartGranularity, today: string): string {
  const day = formatDateLabel(date, today)
  if (granularity === 'day') return day
  return `Week ending ${/^(Today|Yesterday|Tomorrow)$/.test(day) ? day.toLowerCase() : day}`
}
