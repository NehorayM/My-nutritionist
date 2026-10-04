import type { WeightChartGranularity } from '@/domain/weight'
import { formatNumber } from '@/lib/format'
import type { WeightUnit } from '@/types'
import { pointDateLabel, type ChartDatum } from '../lib/chartModel'
import { CHART_COLORS } from './chartTheme'

interface ChartTooltipProps {
  /** Injected by Recharts when the tooltip is shown. */
  active?: boolean
  /** Injected by Recharts: the hovered x value (date key). */
  label?: string | number
  byDate: ReadonlyMap<string, ChartDatum>
  unit: WeightUnit
  granularity: WeightChartGranularity
  today: string
}

function Row({ color, label, value, unit }: { color: string; label: string; value: number | null; unit: WeightUnit }) {
  if (value === null) return null
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-text-muted">{label}</span>
      <span className="font-semibold tabular-nums text-text">
        {formatNumber(value, 1)} {unit}
      </span>
    </div>
  )
}

/** Hover/touch details for one chart point, values formatted in the user's unit. */
export function ChartTooltip({ active, label, byDate, unit, granularity, today }: ChartTooltipProps) {
  const datum = typeof label === 'string' ? byDate.get(label) : undefined
  if (!active || !datum) return null
  return (
    <div className="min-w-40 space-y-1 rounded-field bg-surface px-3 py-2 text-xs shadow-raised ring-1 ring-border">
      <p className="font-bold text-text">{pointDateLabel(datum.date, granularity, today)}</p>
      <Row color={CHART_COLORS.weighIn} label={granularity === 'week' ? 'Weekly average' : 'Weigh-in'} value={datum.weight} unit={unit} />
      <Row color={CHART_COLORS.trend} label="7-day trend" value={datum.trend} unit={unit} />
      <Row color={CHART_COLORS.target} label="Target pace" value={datum.target} unit={unit} />
    </div>
  )
}
