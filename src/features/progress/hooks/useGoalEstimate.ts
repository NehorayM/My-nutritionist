import { useMemo } from 'react'
import {
  calculateTrajectory,
  isWeightChangeGoal,
  safeWeeklyRateKg,
  type WeightTrajectory,
} from '@/domain/weight'
import type { GoalPace, WellnessGoal } from '@/types'

interface GoalEstimateInput {
  goal: WellnessGoal
  pace: GoalPace
  targetKg: number | null
  currentKg: number | null
  isAdult: boolean
  today: string
}

export interface GoalEstimate {
  /** Estimated trajectory for these settings; null when none applies (see calculateTrajectory). */
  trajectory: WeightTrajectory | null
  /** Planned weekly change per pace at the current weight (kg, unsigned); null without a weight-change goal. */
  paceRatesKg: Record<GoalPace, number> | null
}

/** Live estimate for the goal form (weight engine: capped, adults only). */
export function useGoalEstimate({ goal, pace, targetKg, currentKg, isAdult, today }: GoalEstimateInput): GoalEstimate {
  return useMemo(() => {
    const trajectory = calculateTrajectory({ goal, goalPace: pace, targetKg, currentKg, isAdult, startDate: today })
    if (!isAdult || !isWeightChangeGoal(goal) || currentKg === null) return { trajectory, paceRatesKg: null }
    const paceRatesKg = {
      gentle: safeWeeklyRateKg(currentKg, goal, 'gentle'),
      moderate: safeWeeklyRateKg(currentKg, goal, 'moderate'),
    }
    return { trajectory, paceRatesKg }
  }, [goal, pace, targetKg, currentKg, isAdult, today])
}
