import type { WeightChartGranularity } from '@/domain/weight'
import { CHART_COLORS } from './chartTheme'

interface ChartLegendProps {
  granularity: WeightChartGranularity
  showTarget: boolean
}

function LineKey({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg aria-hidden="true" width="20" height="8" viewBox="0 0 20 8" className="shrink-0">
      <line x1="1" y1="4" x2="19" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  )
}

function DotKey() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
      <circle cx="6" cy="6" r="4.5" fill={CHART_COLORS.weighIn} />
    </svg>
  )
}

/** Series key above the chart; text stays in text colors, the mark beside it carries the series color. */
export function ChartLegend({ granularity, showTarget }: ChartLegendProps) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-text-muted" aria-label="Chart key">
      <li className="flex items-center gap-1.5">
        <DotKey />
        {granularity === 'week' ? 'Weekly average' : 'Weigh-ins'}
      </li>
      <li className="flex items-center gap-1.5">
        <LineKey color={CHART_COLORS.trend} />
        7-day trend
      </li>
      {showTarget ? (
        <li className="flex items-center gap-1.5">
          <LineKey color={CHART_COLORS.target} dashed />
          Target pace (estimate)
        </li>
      ) : null}
    </ul>
  )
}
