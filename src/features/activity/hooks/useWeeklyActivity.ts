import { useMemo } from 'react'
import {
  computeWeeklyProgress,
  estimateWorkoutKcal,
  planCatchUp,
  type CatchUpPlan,
  type WeeklyActivityProgress,
} from '@/domain/activity'
import { useActivityStore } from '@/stores/activityStore'
import { useUiStore } from '@/stores/uiStore'
import { latestWeightKg, useWeightStore } from '@/stores/weightStore'
import type { Intensity, Profile, WorkoutType } from '@/types'

/** This week's progress against the CURRENT plan (recomputed as soon as the plan or workouts change). */
export function useWeeklyProgress(profile: Profile, today: string): WeeklyActivityProgress {
  const workouts = useActivityStore((s) => s.workouts)
  const { strengthSessionsPerWeek, cardioSessionsPerWeek, weekStartsOn } = profile
  return useMemo(
    () =>
      computeWeeklyProgress({
        workouts,
        plan: { strengthSessionsPerWeek, cardioSessionsPerWeek },
        today,
        weekStartsOn,
      }),
    [workouts, strengthSessionsPerWeek, cardioSessionsPerWeek, today, weekStartsOn],
  )
}

export interface CatchUpView {
  plan: CatchUpPlan
  /** True when dismissed suggestions are currently hidden from the plan. */
  hasHidden: boolean
}

/** Smart Catch-Up for this week; `variant` rotates through the alternative options. */
export function useCatchUpPlan(profile: Profile, progress: WeeklyActivityProgress, variant: number): CatchUpView {
  const workouts = useActivityStore((s) => s.workouts)
  const scheduled = useActivityStore((s) => s.scheduled)
  const dismissedIds = useUiStore((s) => s.dismissedCatchUpsFor(progress.week.start))
  const preferredMinutes = profile.preferredWorkoutMinutes
  return useMemo(() => {
    const input = { progress, recentWorkouts: workouts, scheduled, preferredMinutes, variant }
    const plan = planCatchUp({ ...input, dismissedIds })
    if (dismissedIds.length === 0) return { plan, hasHidden: false }
    // A dismissal swaps in another option, so compare with every option offered when nothing is dismissed.
    const full = planCatchUp({ ...input, dismissedIds: [] })
    const offered = new Set([full.suggestions, ...full.alternatives].flat().map((suggestion) => suggestion.id))
    return { plan, hasHidden: dismissedIds.some((id) => offered.has(id)) }
  }, [progress, workouts, scheduled, preferredMinutes, dismissedIds, variant])
}

/** Body weight for informational kcal estimates: the latest weigh-in, else the profile weight. */
export function useEstimateWeightKg(profile: Profile, today: string): number | null {
  const entries = useWeightStore((s) => s.entries)
  const fallback = profile.currentWeightKg
  return useMemo(() => latestWeightKg(entries, today) ?? fallback, [entries, today, fallback])
}

interface EstimateInput {
  type: WorkoutType
  intensity: Intensity
  durationMin: number | null
}

/** Live MET-based estimate (informational only), or null when it cannot be computed. */
export function useKcalEstimate({ type, intensity, durationMin }: EstimateInput, weightKg: number | null): number | null {
  return useMemo(
    () => (durationMin === null ? null : estimateWorkoutKcal({ type, intensity, durationMin, weightKg })),
    [type, intensity, durationMin, weightKg],
  )
}
