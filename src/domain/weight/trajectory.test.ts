import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/dates'
import { GOAL_PACES } from '@/types'
import { MAX_SHARE_PER_WEEK, PLANNED_SHARE_PER_WEEK, WEIGHT_CHANGE_GOALS } from './constants'
import { calculateTrajectory, isWeightChangeGoal, safeWeeklyRateKg, trajectoryWeightOn } from './trajectory'
import type { TrajectoryInput } from './types'

const TODAY = '2026-10-03'

function input(overrides: Partial<TrajectoryInput> = {}): TrajectoryInput {
  return {
    currentKg: 80,
    targetKg: 72,
    goal: 'lose_weight',
    goalPace: 'moderate',
    isAdult: true,
    startDate: TODAY,
    ...overrides,
  }
}

describe('safeWeeklyRateKg', () => {
  it('uses the pace share of body weight while it is below the energy cap', () => {
    expect(safeWeeklyRateKg(80, 'lose_weight', 'moderate')).toBe(0.4)
    expect(safeWeeklyRateKg(80, 'lose_weight', 'gentle')).toBe(0.2)
    expect(safeWeeklyRateKg(60, 'gain_weight', 'gentle')).toBe(0.15)
    expect(safeWeeklyRateKg(50, 'gain_weight', 'moderate')).toBe(0.25)
  })

  it('never runs faster than the calorie plan’s daily deficit/surplus cap implies', () => {
    // 500 kcal/d × 7 / 7700 ≈ 0.455; 250 → 0.227; 300 → 0.273 kg/week.
    expect(safeWeeklyRateKg(100, 'lose_weight', 'moderate')).toBe(0.455)
    expect(safeWeeklyRateKg(120, 'lose_weight', 'gentle')).toBe(0.227)
    expect(safeWeeklyRateKg(60, 'gain_weight', 'moderate')).toBe(0.273)
    expect(safeWeeklyRateKg(150, 'gain_weight', 'gentle')).toBe(0.227)
  })

  it('stays within the pace share and the hard ceilings (1 %/week loss, 0.5 %/week gain) at any weight', () => {
    for (const goal of WEIGHT_CHANGE_GOALS) {
      for (const pace of GOAL_PACES) {
        for (let kg = 20; kg <= 600; kg += 10) {
          const rate = safeWeeklyRateKg(kg, goal, pace)
          expect(rate).toBeGreaterThan(0)
          expect(rate).toBeLessThanOrEqual(kg * PLANNED_SHARE_PER_WEEK[goal][pace] + 0.0005)
          expect(rate).toBeLessThanOrEqual(kg * MAX_SHARE_PER_WEEK[goal])
        }
      }
    }
  })
})

describe('isWeightChangeGoal', () => {
  it('accepts only lose_weight and gain_weight', () => {
    expect(isWeightChangeGoal('lose_weight')).toBe(true)
    expect(isWeightChangeGoal('gain_weight')).toBe(true)
    expect(isWeightChangeGoal('maintain')).toBe(false)
    expect(isWeightChangeGoal('general_wellness')).toBe(false)
    expect(isWeightChangeGoal('build_muscle')).toBe(false)
  })
})

describe('trajectoryWeightOn', () => {
  const loss = { startDate: TODAY, startKg: 80, targetKg: 79, ratePerWeekKg: -0.5 }
  const gain = { startDate: TODAY, startKg: 60, targetKg: 60.4, ratePerWeekKg: 0.3 }

  it('returns the start weight on and before the start date', () => {
    expect(trajectoryWeightOn(loss, TODAY)).toBe(80)
    expect(trajectoryWeightOn(loss, addDays(TODAY, -10))).toBe(80)
  })

  it('moves along a straight line and holds at the target once reached', () => {
    expect(trajectoryWeightOn(loss, addDays(TODAY, 7))).toBe(79.5)
    expect(trajectoryWeightOn(loss, addDays(TODAY, 1))).toBe(79.929)
    expect(trajectoryWeightOn(loss, addDays(TODAY, 14))).toBe(79)
    expect(trajectoryWeightOn(loss, addDays(TODAY, 60))).toBe(79)
    expect(trajectoryWeightOn(gain, addDays(TODAY, 7))).toBe(60.3)
    expect(trajectoryWeightOn(gain, addDays(TODAY, 14))).toBe(60.4)
  })
})

describe('calculateTrajectory', () => {
  it('plans a moderate loss at 0.5 % of body weight per week with weekly waypoints', () => {
    const plan = calculateTrajectory(input())
    expect(plan).toMatchObject({
      ratePerWeekKg: -0.4,
      startDate: TODAY,
      startKg: 80,
      targetKg: 72,
      // 8 kg / 0.4 kg per week = 20 weeks = 140 days.
      estimatedGoalDate: '2027-02-20',
      estimatedWeeks: 20,
    })
    expect(plan?.points).toHaveLength(21)
    expect(plan?.points[0]).toEqual({ date: TODAY, targetKg: 80 })
    expect(plan?.points[1]).toEqual({ date: '2026-10-10', targetKg: 79.6 })
    expect(plan?.points.at(-1)).toEqual({ date: '2027-02-20', targetKg: 72 })
  })

  it('rounds a partial final week up to the first day the line reaches the target', () => {
    // 4.9 kg / 0.4 kg per week × 7 = 85.75 → 86 days.
    const plan = calculateTrajectory(input({ targetKg: 75.1 }))
    expect(plan?.estimatedGoalDate).toBe('2026-12-28')
    expect(plan?.estimatedWeeks).toBe(13)
    expect(plan?.points.slice(-2)).toEqual([
      { date: addDays(TODAY, 84), targetKg: 75.2 },
      { date: '2026-12-28', targetKg: 75.1 },
    ])
  })

  it('plans a gain with a positive rate', () => {
    const plan = calculateTrajectory(input({ currentKg: 60, targetKg: 63, goal: 'gain_weight', goalPace: 'gentle' }))
    expect(plan).toMatchObject({ ratePerWeekKg: 0.15, estimatedGoalDate: addDays(TODAY, 140), estimatedWeeks: 20 })
    expect(plan?.points[1]?.targetKg).toBe(60.15)
  })

  it('uses the capped rate for heavier bodies', () => {
    const plan = calculateTrajectory(input({ currentKg: 100, targetKg: 90 }))
    expect(plan?.ratePerWeekKg).toBe(-0.455)
    // 10 / 0.455 × 7 = 153.85 → 154 days.
    expect(plan?.estimatedGoalDate).toBe(addDays(TODAY, 154))
  })

  it('does not let floating-point noise add a day', () => {
    // 0.9 kg at 0.1 kg/week is exactly 63 days although 0.9 / 0.1 × 7 = 63.000000000000014.
    const plan = calculateTrajectory(input({ currentKg: 40, targetKg: 39.1, goalPace: 'gentle' }))
    expect(plan?.estimatedGoalDate).toBe(addDays(TODAY, 63))
    expect(plan?.estimatedWeeks).toBe(9)
  })

  it('crosses month and year boundaries by calendar day', () => {
    const plan = calculateTrajectory(input({ startDate: '2026-12-20', currentKg: 80, targetKg: 79 }))
    // 1 / 0.4 × 7 = 17.5 → 18 days.
    expect(plan?.estimatedGoalDate).toBe('2027-01-07')
    expect(plan?.points.map((p) => p.date)).toEqual(['2026-12-20', '2026-12-27', '2027-01-03', '2027-01-07'])
  })

  it('returns null for minors whatever the goal', () => {
    expect(calculateTrajectory(input({ isAdult: false }))).toBeNull()
    expect(calculateTrajectory(input({ isAdult: false, goal: 'gain_weight', targetKg: 85 }))).toBeNull()
  })

  it('returns null for goals without a weight change', () => {
    for (const goal of ['maintain', 'general_wellness', 'build_muscle'] as const) {
      expect(calculateTrajectory(input({ goal }))).toBeNull()
    }
  })

  it('returns null without a usable current or target weight', () => {
    expect(calculateTrajectory(input({ targetKg: null }))).toBeNull()
    expect(calculateTrajectory(input({ currentKg: null }))).toBeNull()
    expect(calculateTrajectory(input({ targetKg: Number.NaN }))).toBeNull()
    expect(calculateTrajectory(input({ currentKg: Number.POSITIVE_INFINITY }))).toBeNull()
    expect(calculateTrajectory(input({ targetKg: 15 }))).toBeNull()
    expect(calculateTrajectory(input({ currentKg: 700, targetKg: 500 }))).toBeNull()
  })

  it('returns null within 0.2 kg of the target (inclusive)', () => {
    expect(calculateTrajectory(input({ targetKg: 80 }))).toBeNull()
    expect(calculateTrajectory(input({ targetKg: 79.8 }))).toBeNull()
    expect(calculateTrajectory(input({ goal: 'gain_weight', targetKg: 80.2 }))).toBeNull()
    // 0.21 kg / 0.4 kg per week × 7 = 3.675 → 4 days.
    expect(calculateTrajectory(input({ targetKg: 79.79 }))?.estimatedGoalDate).toBe(addDays(TODAY, 4))
  })

  it('returns null when the target is on the other side of the goal’s direction', () => {
    expect(calculateTrajectory(input({ goal: 'lose_weight', targetKg: 85 }))).toBeNull()
    expect(calculateTrajectory(input({ goal: 'gain_weight', targetKg: 75 }))).toBeNull()
  })
})
