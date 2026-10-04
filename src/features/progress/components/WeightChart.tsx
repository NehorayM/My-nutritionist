import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { formatNumber } from '@/lib/format'
import type { WeightChartModel } from '../hooks/useWeightChart'
import { axisDateLabel, type ChartDatum } from '../lib/chartModel'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS, CHART_HEIGHT, TARGET_DASH } from './chartTheme'

interface WeightChartProps {
  model: WeightChartModel
  today: string
}

const AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 12 }
const DOT = { r: 4, fill: CHART_COLORS.weighIn, stroke: CHART_COLORS.surface, strokeWidth: 2 }
const ACTIVE_DOT = { r: 6, fill: CHART_COLORS.weighIn, stroke: CHART_COLORS.surface, strokeWidth: 2 }

/**
 * Recharts drawing of the weight series. Decorative for assistive tech: the figure's text summary and
 * the data table carry the same information, so the SVG is hidden from the accessibility tree.
 */
export function WeightChart({ model, today }: WeightChartProps) {
  const reducedMotion = usePrefersReducedMotion()
  const { data, ticks, y, granularity, showTarget, unit } = model
  const byDate = useMemo(() => new Map<string, ChartDatum>(data.map((row) => [row.date, row])), [data])
  const animate = !reducedMotion

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="date"
          ticks={ticks}
          interval={0}
          tickFormatter={(date: string) => axisDateLabel(date, granularity)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tickMargin={6}
          padding={{ left: 8, right: 8 }}
        />
        <YAxis
          domain={y?.domain ?? ['auto', 'auto']}
          ticks={y?.ticks}
          interval={0}
          allowDecimals={false}
          width={unit === 'lb' ? 40 : 34}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => formatNumber(value, 0)}
        />
        <Tooltip
          cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 1 }}
          isAnimationActive={false}
          content={<ChartTooltip byDate={byDate} unit={unit} granularity={granularity} today={today} />}
        />
        {showTarget ? <ReferenceLine x={today} stroke={CHART_COLORS.grid} strokeDasharray="2 3" /> : null}
        <Line
          type="monotone"
          dataKey="trend"
          stroke={CHART_COLORS.trend}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={false}
          connectNulls
          isAnimationActive={animate}
        />
        {showTarget ? (
          <Line
            type="linear"
            dataKey="target"
            stroke={CHART_COLORS.target}
            strokeWidth={2}
            strokeDasharray={TARGET_DASH}
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={animate}
          />
        ) : null}
        <Line
          type="linear"
          dataKey="weight"
          stroke="none"
          dot={DOT}
          activeDot={ACTIVE_DOT}
          isAnimationActive={animate}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
