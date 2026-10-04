import { ArrowDownRight, ArrowRight, ArrowUpRight, LineChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Stat } from '@/components/ui'
import type { TrendDirection, WeightStats } from '@/domain/weight'
import { formatDateLabel, formatWeight, formatWeightDelta } from '@/lib/format'
import type { UnitSystem } from '@/types'
import { distanceCopy, trendDetail, trendSummary } from '../lib/progressCopy'

interface StatsCardProps {
  stats: WeightStats
  unitSystem: UnitSystem
  today: string
  firstDate: string | null
  /** Target for "distance to goal", or null when no adult weight-change target applies. */
  targetKg: number | null
  /** Show the "to target" tile (adults with a weight-change goal); otherwise show logged days. */
  tracksTarget: boolean
}

const TREND_ICONS: Record<TrendDirection, typeof ArrowRight> = {
  down: ArrowDownRight,
  up: ArrowUpRight,
  stable: ArrowRight,
  insufficient_data: LineChart,
}

function split(text: string): { value: string; unit?: string } {
  const match = /^(.*\d)\s+(kg|lb)$/.exec(text)
  return match ? { value: match[1]!, unit: match[2] } : { value: text }
}

/** Current weight, weekly and total change, distance to goal, and the trend in neutral words. */
export function StatsCard({ stats, unitSystem, today, firstDate, targetKg, tracksTarget }: StatsCardProps) {
  const current = stats.current
  const TrendIcon = TREND_ICONS[stats.trend]
  const distance =
    targetKg !== null && stats.distanceToGoalKg !== null ? distanceCopy(stats.distanceToGoalKg, targetKg, unitSystem) : null

  return (
    <Card as="section" aria-labelledby="stats-title">
      <CardHeader>
        <CardTitle as="h2" id="stats-title">
          Your numbers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <StatItem
            label="Current"
            text={formatWeight(current?.weightKg, unitSystem)}
            hint={current ? formatDateLabel(current.date, today) : 'No weigh-ins yet'}
            emphasis
          />
          <StatItem
            label="Weekly change"
            text={formatWeightDelta(stats.weeklyChangeKg, unitSystem)}
            hint={stats.weeklyChangeKg === null ? 'Needs about a week of weigh-ins' : 'vs. about a week earlier'}
          />
          <StatItem
            label="Total change"
            text={formatWeightDelta(stats.totalChangeKg, unitSystem)}
            hint={stats.totalChangeKg === null || !firstDate ? 'Needs weigh-ins on 2+ days' : `Since ${formatDateLabel(firstDate, today)}`}
          />
          {tracksTarget ? (
            <StatItem
              label="To target"
              text={distance?.value ?? '—'}
              hint={distance?.hint ?? 'Add a target weight in Goal settings'}
            />
          ) : (
            <StatItem label="Days logged" text={String(stats.measurementDays)} hint="Days with a weigh-in" />
          )}
        </div>
        <div className="flex items-start gap-3 rounded-field bg-surface-2 px-3.5 py-3">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
            <TrendIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold text-text">{trendSummary(stats, unitSystem)}</p>
            <p className="text-sm text-text-muted">{trendDetail(stats)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface StatItemProps {
  label: string
  /** Formatted value; a trailing kg/lb is shown as the unit. */
  text: string
  hint: string
  emphasis?: boolean
}

function StatItem({ label, text, hint, emphasis = false }: StatItemProps) {
  const { value, unit } = split(text)
  return <Stat label={label} value={value} unit={unit} hint={hint} size={emphasis ? 'md' : 'sm'} />
}
