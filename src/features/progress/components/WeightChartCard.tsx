import { CalendarRange, Table2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, SegmentedControl } from '@/components/ui'
import type { WeightGoalInput, WeightRange } from '@/domain/weight'
import type { Profile, WeightEntry } from '@/types'
import { useWeightChart } from '../hooks/useWeightChart'
import { RANGE_LABELS } from '../lib/chartModel'
import { ChartLegend } from './ChartLegend'
import { WeightChart } from './WeightChart'
import { WeightDataTable } from './WeightDataTable'

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
] as const satisfies readonly { value: WeightRange; label: string }[]

interface WeightChartCardProps {
  profile: Profile
  entries: readonly WeightEntry[]
  today: string
  goalInput: WeightGoalInput
}

/** Range switcher, chart with legend and text summary, and an optional data table. */
export function WeightChartCard({ profile, entries, today, goalInput }: WeightChartCardProps) {
  const [range, setRange] = useState<WeightRange>('30d')
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()
  const model = useWeightChart({
    entries,
    range,
    today,
    goalInput,
    unitSystem: profile.unitSystem,
    weekStartsOn: profile.weekStartsOn,
  })
  const empty = model.data.length === 0

  return (
    <Card as="section" aria-labelledby="chart-title">
      <CardHeader action={model.granularity === 'week' ? <Badge tone="info">Weekly averages</Badge> : undefined}>
        <CardTitle as="h2" id="chart-title">
          Weight trend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SegmentedControl label="Chart range" value={range} onValueChange={setRange} options={RANGE_OPTIONS} fullWidth size="sm" />
        {empty ? (
          <EmptyState
            compact
            icon={<CalendarRange />}
            title={`No weigh-ins in the ${RANGE_LABELS[range].toLowerCase()}`}
            description="Earlier weigh-ins are still here — switch to All time to see them."
            actions={
              <Button variant="secondary" size="sm" onClick={() => setRange('all')}>
                Show all time
              </Button>
            }
          />
        ) : (
          <figure aria-labelledby="chart-title" aria-describedby="chart-summary" className="space-y-3">
            <ChartLegend granularity={model.granularity} showTarget={model.showTarget} />
            <div aria-hidden="true" className="-ml-1">
              <WeightChart model={model} today={today} />
            </div>
            <figcaption id="chart-summary" aria-live="polite" className="text-sm text-text-muted">
              {model.summary}
            </figcaption>
          </figure>
        )}
        {empty ? null : (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Table2 />}
              aria-expanded={showTable}
              aria-controls={showTable ? tableId : undefined}
              onClick={() => setShowTable((open) => !open)}
              className="-ml-2"
            >
              {showTable ? 'Hide data table' : 'Show data table'}
            </Button>
            {showTable ? (
              <WeightDataTable
                id={tableId}
                data={model.data}
                range={range}
                granularity={model.granularity}
                unit={model.unit}
                showTarget={model.showTarget}
                today={today}
              />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
