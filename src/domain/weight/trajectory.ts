import type { GoalPace, WellnessGoal } from '@/types'
import { addDays, daysBetween } from '@/domain/dates'
import { roundTo } from '@/domain/units'
import {
  DAYS_PER_WEEK,
  ENERGY_CAP_KCAL_PER_DAY,
  GOAL_TOLERANCE_KG,
  KCAL_PER_KG_BODY_WEIGHT,
  MAX_SHARE_PER_WEEK,
  PLANNED_SHARE_PER_WEEK,
  PLAUSIBLE_BODY_WEIGHT_KG,
  WEIGHT_CHANGE_GOALS,
  type WeightChangeGoal,
} from './constants'
import { roundKg } from './math'
import type { TrajectoryInput, TrajectoryPoint, WeightTrajectory } from './types'

type TrajectoryLine = Pick<WeightTrajectory, 'startDate' | 'startKg' | 'targetKg' | 'ratePerWeekKg'>

export function isWeightChangeGoal(goal: WellnessGoal): goal is WeightChangeGoal {
  return (WEIGHT_CHANGE_GOALS as readonly WellnessGoal[]).includes(goal)
}

/** NaN and ±Infinity fail the range comparisons too. */
function isPlausibleBodyWeight(value: number | null): value is number {
  return value !== null && value >= PLAUSIBLE_BODY_WEIGHT_KG.min && value <= PLAUSIBLE_BODY_WEIGHT_KG.max
}

/**
 * Planned weekly rate (kg, unsigned) for a weight-change goal: the pace's share of current body weight,
 * never faster than the calorie plan's daily deficit/surplus cap implies, and never above the hard
 * ceiling (1 %/week loss, 0.5 %/week gain).
 */
export function safeWeeklyRateKg(currentKg: number, goal: WeightChangeGoal, pace: GoalPace): number {
  const planned = currentKg * PLANNED_SHARE_PER_WEEK[goal][pace]
  const energyCap = (ENERGY_CAP_KCAL_PER_DAY[goal][pace] * DAYS_PER_WEEK) / KCAL_PER_KG_BODY_WEIGHT
  const ceiling = currentKg * MAX_SHARE_PER_WEEK[goal]
  return roundKg(Math.min(planned, energyCap, ceiling))
}

/**
 * Planned weight on `date`: a straight line from startKg at the planned rate, held at the target once
 * reached. Dates before startDate return startKg.
 */
export function trajectoryWeightOn(line: TrajectoryLine, date: string): number {
  const days = Math.max(0, daysBetween(line.startDate, date))
  const planned = line.startKg + (line.ratePerWeekKg * days) / DAYS_PER_WEEK
  const held = line.ratePerWeekKg < 0 ? Math.max(planned, line.targetKg) : Math.min(planned, line.targetKg)
  return roundKg(held)
}

/**
 * Target trajectory for a configured weight goal, or null when none should be shown: not an adult,
 * goal other than lose_weight/gain_weight, no (or implausible) current/target weight, target within
 * 0.2 kg of current, or target on the opposite side of the goal's direction.
 *
 * The rate (see safeWeeklyRateKg) is fixed at the starting weight, so the line is straight; callers
 * re-anchor on today's trend each day. estimatedGoalDate = startDate + ceil(|target − current| / rate × 7)
 * days. Points are weekly from startDate, ending with the goal date at the target.
 */
export function calculateTrajectory(input: TrajectoryInput): WeightTrajectory | null {
  const { currentKg, targetKg, startDate, goal, goalPace, isAdult } = input
  if (!isAdult || !isWeightChangeGoal(goal)) return null
  if (!isPlausibleBodyWeight(currentKg) || !isPlausibleBodyWeight(targetKg)) return null

  const direction = goal === 'lose_weight' ? -1 : 1
  const deltaKg = roundKg(targetKg - currentKg)
  if (Math.abs(deltaKg) <= GOAL_TOLERANCE_KG || Math.sign(deltaKg) !== direction) return null

  const rateKg = safeWeeklyRateKg(currentKg, goal, goalPace)
  // Round before ceil so floating-point noise (e.g. 70.0000000001) cannot add a day.
  const days = Math.ceil(roundTo((Math.abs(deltaKg) / rateKg) * DAYS_PER_WEEK, 6))
  const line: TrajectoryLine = { startDate, startKg: currentKg, targetKg, ratePerWeekKg: direction * rateKg }
  const estimatedGoalDate = addDays(startDate, days)

  const points: TrajectoryPoint[] = []
  for (let offset = 0; offset < days; offset += DAYS_PER_WEEK) {
    const date = addDays(startDate, offset)
    points.push({ date, targetKg: trajectoryWeightOn(line, date) })
  }
  points.push({ date: estimatedGoalDate, targetKg })

  return { ...line, estimatedGoalDate, estimatedWeeks: Math.ceil(days / DAYS_PER_WEEK), points }
}
