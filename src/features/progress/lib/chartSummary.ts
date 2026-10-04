import type { WeightChartGranularity, WeightRange } from '@/domain/weight'
import { formatDateLabel, formatNumber } from '@/lib/format'
import type { WeightUnit } from '@/types'
import { RANGE_LABELS, type ChartDatum } from './chartModel'

interface SummaryOptions {
  range: WeightRange
  granularity: WeightChartGranularity
  unit: WeightUnit
  today: string
}

function amount(value: number, unit: WeightUnit): string {
  return `${formatNumber(value, 1)} ${unit}`
}

const RELATIVE_DAY = /^(Today|Yesterday|Tomorrow)$/

/** A date inside a sentence: "today", "on Mon, Sep 28", "in the week ending Sun, Sep 27" (`by` for the target). */
function datePhrase(date: string, today: string, granularity: WeightChartGranularity, preposition: 'on' | 'by'): string {
  const label = formatDateLabel(date, today)
  const day = RELATIVE_DAY.test(label) ? label.toLowerCase() : label
  if (granularity === 'week' && preposition === 'on') return `in the week ending ${day}`
  return RELATIVE_DAY.test(label) ? day : `${preposition} ${day}`
}

/**
 * Text alternative for the chart (read by screen readers and shown under it): what is plotted,
 * where it starts and ends, the current trend, and where the target pace line leads.
 */
export function chartSummary(data: readonly ChartDatum[], { range, granularity, unit, today }: SummaryOptions): string {
  const on = (date: string) => datePhrase(date, today, granularity, 'on')
  const weighIns = data.filter((row): row is ChartDatum & { weight: number } => row.weight !== null)
  const first = weighIns[0]
  const last = weighIns[weighIns.length - 1]
  if (!first || !last) {
    return `${RANGE_LABELS[range]}: no weigh-ins in this period. Try a longer range to see earlier ones.`
  }

  const count = weighIns.length
  const what = granularity === 'week' ? `${count} weekly ${count === 1 ? 'average' : 'averages'}` : `${count} weigh-in ${count === 1 ? 'day' : 'days'}`
  const parts = [
    count === 1
      ? `${RANGE_LABELS[range]}: ${what}, ${amount(first.weight, unit)} ${on(first.date)}.`
      : `${RANGE_LABELS[range]}: ${what}, from ${amount(first.weight, unit)} ${on(first.date)} to ${amount(last.weight, unit)} ${on(last.date)}.`,
  ]

  const latestTrend = [...data].reverse().find((row) => row.trend !== null)
  if (latestTrend?.trend != null) parts.push(`7-day average ${amount(latestTrend.trend, unit)}.`)

  const lastTarget = [...data].reverse().find((row) => row.target !== null)
  if (lastTarget?.target != null) {
    parts.push(`Target pace line reaches ${amount(lastTarget.target, unit)} ${datePhrase(lastTarget.date, today, 'day', 'by')}.`)
  }
  return parts.join(' ')
}
