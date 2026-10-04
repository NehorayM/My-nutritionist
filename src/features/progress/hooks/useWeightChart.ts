import { useMemo } from 'react'
import {
  buildWeightChart,
  weightChartGranularity,
  type WeightChartGranularity,
  type WeightGoalInput,
  type WeightRange,
} from '@/domain/weight'
import type { UnitSystem, WeightEntry, WeightUnit } from '@/types'
import { chartTicks, hasTarget, toChartData, yScale, type ChartDatum, type YScale } from '../lib/chartModel'
import { chartSummary } from '../lib/chartSummary'
import { weightUnitFor } from '../lib/weightUnits'

interface WeightChartInput {
  entries: readonly WeightEntry[]
  range: WeightRange
  today: string
  goalInput: WeightGoalInput
  unitSystem: UnitSystem
  weekStartsOn: 0 | 1
}

export interface WeightChartModel {
  data: ChartDatum[]
  unit: WeightUnit
  granularity: WeightChartGranularity
  showTarget: boolean
  ticks: string[]
  y: YScale | null
  summary: string
}

/** Chart rows for the selected range. The target line exists only when the engine returns target values. */
export function useWeightChart({ entries, range, today, goalInput, unitSystem, weekStartsOn }: WeightChartInput): WeightChartModel {
  return useMemo(() => {
    const unit = weightUnitFor(unitSystem)
    const granularity = weightChartGranularity(entries, { range, today })
    const data = toChartData(buildWeightChart(entries, { range, today, trajectory: goalInput }), unit)
    return {
      data,
      unit,
      granularity,
      showTarget: hasTarget(data),
      ticks: chartTicks(
        data.map((row) => row.date),
        granularity,
        weekStartsOn,
      ),
      y: yScale(data),
      summary: chartSummary(data, { range, granularity, unit, today }),
    }
  }, [entries, range, today, goalInput, unitSystem, weekStartsOn])
}
