import { CalendarClock } from 'lucide-react'
import type { WeightTrajectory } from '@/domain/weight'
import { formatLongDate, formatWeight } from '@/lib/format'
import type { UnitSystem } from '@/types'

interface GoalEstimateNoteProps {
  trajectory: WeightTrajectory | null
  unitSystem: UnitSystem
  /** Why there is no estimate (shown when trajectory is null), or null to show nothing. */
  fallback: string | null
}

/** Estimated goal date for the current settings, always framed as an estimate. */
export function GoalEstimateNote({ trajectory, unitSystem, fallback }: GoalEstimateNoteProps) {
  if (!trajectory && !fallback) return null
  return (
    <output className="flex gap-3 rounded-field bg-surface-2 px-3.5 py-3 text-sm">
      <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      {trajectory ? (
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-text">
            {`Estimated around ${formatLongDate(trajectory.estimatedGoalDate)} (about ${trajectory.estimatedWeeks} ${trajectory.estimatedWeeks === 1 ? 'week' : 'weeks'})`}
          </p>
          <p className="text-text-muted">
            {`About ${formatWeight(Math.abs(trajectory.ratePerWeekKg), unitSystem)} per week toward ${formatWeight(trajectory.targetKg, unitSystem)}. This is an estimate — real progress varies week to week, and it updates with your trend.`}
          </p>
        </div>
      ) : (
        <p className="text-text-muted">{fallback}</p>
      )}
    </output>
  )
}
