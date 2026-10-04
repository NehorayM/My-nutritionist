import { describe, expect, it } from 'vitest'
import { dailyKcalForWeeklyRate, goalAdjustment, maintenanceFromBmr, mifflinStJeorBmr, type GoalAdjustmentInput } from './energy'

describe('mifflinStJeorBmr', () => {
  const body = { weightKg: 70, heightCm: 165, ageYears: 30 }

  it('uses the female and male equations', () => {
    expect(mifflinStJeorBmr({ ...body, sex: 'female' })).toBeCloseTo(1420.25, 10)
    expect(mifflinStJeorBmr({ ...body, sex: 'male' })).toBeCloseTo(1586.25, 10)
  })

  it('averages both equations when sex is unspecified', () => {
    const female = mifflinStJeorBmr({ ...body, sex: 'female' })
    const male = mifflinStJeorBmr({ ...body, sex: 'male' })
    expect(mifflinStJeorBmr({ ...body, sex: 'unspecified' })).toBeCloseTo((female + male) / 2, 10)
  })
})

describe('maintenanceFromBmr', () => {
  it.each([
    ['sedentary', 1200],
    ['light', 1375],
    ['moderate', 1550],
    ['active', 1725],
    ['very_active', 1900],
  ] as const)('applies the %s activity factor', (level, expected) => {
    expect(maintenanceFromBmr(1000, level)).toBeCloseTo(expected, 10)
  })
})

describe('dailyKcalForWeeklyRate', () => {
  it('converts % body weight per week into kcal/day with 7700 kcal/kg', () => {
    expect(dailyKcalForWeeklyRate(80, 0.5)).toBeCloseTo(440, 10)
    expect(dailyKcalForWeeklyRate(80, 0.25)).toBeCloseTo(220, 10)
  })
})

describe('goalAdjustment', () => {
  const base: GoalAdjustmentInput = {
    goal: 'lose_weight',
    pace: 'moderate',
    sex: 'male',
    weightKg: 80,
    targetWeightKg: null,
    maintenanceKcal: 2600,
  }

  it('makes no adjustment for general wellness and maintain', () => {
    expect(goalAdjustment({ ...base, goal: 'general_wellness' })).toEqual({ adjustmentKcal: 0, notes: [] })
    expect(goalAdjustment({ ...base, goal: 'maintain' })).toEqual({ adjustmentKcal: 0, notes: [] })
  })

  it('uses the rate-based deficit when it is below the pace cap', () => {
    expect(goalAdjustment(base).adjustmentKcal).toBe(-440)
    expect(goalAdjustment({ ...base, pace: 'gentle' }).adjustmentKcal).toBe(-220)
  })

  it('caps the deficit per pace', () => {
    expect(goalAdjustment({ ...base, weightKg: 130 }).adjustmentKcal).toBe(-500)
    expect(goalAdjustment({ ...base, weightKg: 130, pace: 'gentle' }).adjustmentKcal).toBe(-250)
  })

  it('describes the deficit in neutral words', () => {
    expect(goalAdjustment(base).notes).toEqual(['Includes a moderate deficit of 440 kcal/day toward your weight goal.'])
  })

  it('keeps the target at the calorie floor for each sex', () => {
    const female = goalAdjustment({ ...base, sex: 'female', maintenanceKcal: 1300, weightKg: 60 })
    expect(female.adjustmentKcal).toBe(-100)
    expect(female.notes[1]).toMatch(/at or above 1,200 kcal\/day/)
    expect(goalAdjustment({ ...base, maintenanceKcal: 1600 }).adjustmentKcal).toBe(-100)
    expect(goalAdjustment({ ...base, sex: 'unspecified', maintenanceKcal: 1700 }).adjustmentKcal).toBe(-200)
  })

  it('never raises a loss target above maintenance', () => {
    const result = goalAdjustment({ ...base, sex: 'female', maintenanceKcal: 1050 })
    expect(result.adjustmentKcal).toBe(0)
    expect(result.notes[0]).toMatch(/estimated maintenance.*registered dietitian/)
    expect(goalAdjustment({ ...base, sex: 'female', maintenanceKcal: 1200 }).adjustmentKcal).toBe(0)
  })

  it('makes no deficit once the target weight is reached', () => {
    const reached = goalAdjustment({ ...base, targetWeightKg: 80 })
    expect(reached.adjustmentKcal).toBe(0)
    expect(reached.notes).toEqual(['You’ve reached your target weight, so energy is set for maintenance.'])
    expect(goalAdjustment({ ...base, targetWeightKg: 85 }).adjustmentKcal).toBe(0)
    expect(goalAdjustment({ ...base, targetWeightKg: 75 }).adjustmentKcal).toBe(-440)
  })

  it('adds a capped surplus for gain_weight and build_muscle', () => {
    const gain = { ...base, goal: 'gain_weight' as const, weightKg: 70 }
    expect(goalAdjustment({ ...gain, pace: 'gentle' }).adjustmentKcal).toBe(190)
    expect(goalAdjustment(gain).adjustmentKcal).toBe(300)
    expect(goalAdjustment({ ...gain, goal: 'build_muscle', pace: 'gentle', weightKg: 120 }).adjustmentKcal).toBe(250)
    expect(goalAdjustment({ ...gain, weightKg: 50 }).adjustmentKcal).toBe(280)
    expect(goalAdjustment(gain).notes).toEqual(['Includes a moderate surplus of 300 kcal/day toward your goal.'])
  })

  it('makes no surplus once the target weight is reached', () => {
    const gain = { ...base, goal: 'build_muscle' as const, weightKg: 70 }
    expect(goalAdjustment({ ...gain, targetWeightKg: 70 }).adjustmentKcal).toBe(0)
    expect(goalAdjustment({ ...gain, targetWeightKg: 65 }).adjustmentKcal).toBe(0)
    expect(goalAdjustment({ ...gain, targetWeightKg: 75 }).adjustmentKcal).toBe(300)
  })
})
