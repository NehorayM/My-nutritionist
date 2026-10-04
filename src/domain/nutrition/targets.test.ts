import { describe, expect, it } from 'vitest'
import { adultProfile, TODAY } from './__fixtures__/nutrition'
import { MINOR_NOTE } from './estimate'
import { calculateDailyTargets } from './targets'

describe('calculateDailyTargets — personalized adults', () => {
  it('calculates calories and macros for an adult woman', () => {
    const result = calculateDailyTargets({ profile: adultProfile(), date: TODAY })
    expect(result.mode).toBe('personalized')
    expect(result.estimate).toEqual({
      method: 'mifflin_st_jeor',
      bmrKcal: 1420,
      maintenanceKcal: 1950,
      goalAdjustmentKcal: 0,
    })
    const t = result.targets
    expect(t.calories).toEqual({ amount: 1950, min: 1760, max: 2150, kind: 'energy' })
    expect(t.protein).toEqual({ amount: 84, min: 49, max: 171, kind: 'goal' })
    expect(t.fat).toEqual({ amount: 65, min: 43, max: 76, kind: 'goal' })
    expect(t.carbs).toEqual({ amount: 257, min: 219, max: 317, kind: 'goal' })
    expect(t.fiber).toEqual({ amount: 27, min: null, max: null, kind: 'goal' })
    expect(t.saturatedFat).toEqual({ amount: 22, min: null, max: 22, kind: 'limit' })
    expect(t.sodium).toEqual({ amount: 2300, min: null, max: 2300, kind: 'limit' })
  })

  it('sets female micronutrient targets for ages 19–50 with upper limits as ceilings', () => {
    const t = calculateDailyTargets({ profile: adultProfile(), date: TODAY }).targets
    expect(t.iron).toEqual({ amount: 18, min: null, max: 45, kind: 'goal' })
    expect(t.calcium).toEqual({ amount: 1000, min: null, max: 2500, kind: 'goal' })
    expect(t.vitaminC).toEqual({ amount: 75, min: null, max: 2000, kind: 'goal' })
    expect(t.vitaminD).toEqual({ amount: 15, min: null, max: 100, kind: 'goal' })
    expect(t.potassium).toEqual({ amount: 2600, min: null, max: null, kind: 'goal' })
  })

  it('gives total sugars no target (display only)', () => {
    expect(calculateDailyTargets({ profile: adultProfile(), date: TODAY }).targets.sugars).toBeUndefined()
  })

  it('calculates a capped deficit for an adult man losing weight', () => {
    const profile = adultProfile({
      sex: 'male',
      birthDate: '1986-01-15',
      heightCm: 180,
      currentWeightKg: 85,
      activityLevel: 'moderate',
      goal: 'lose_weight',
      goalPace: 'moderate',
    })
    const result = calculateDailyTargets({ profile, date: TODAY })
    expect(result.estimate).toEqual({ method: 'mifflin_st_jeor', bmrKcal: 1780, maintenanceKcal: 2760, goalAdjustmentKcal: -470 })
    expect(result.targets.calories?.amount).toBe(2290)
    expect(result.targets.protein?.amount).toBe(136)
    expect(result.targets.iron?.amount).toBe(8)
    expect(result.targets.vitaminC?.amount).toBe(90)
    expect(result.targets.potassium?.amount).toBe(3400)
    expect(result.assumptions).toContain('Includes a moderate deficit of 470 kcal/day toward your weight goal.')
  })

  it('uses older-adult reference intakes from age 51 and 71', () => {
    const at = (birthDate: string, sex: 'female' | 'male') =>
      calculateDailyTargets({ profile: adultProfile({ birthDate, sex }), date: TODAY }).targets
    expect(at('1966-01-01', 'female')).toMatchObject({ iron: { amount: 8 }, calcium: { amount: 1200, max: 2000 } })
    expect(at('1950-01-01', 'male')).toMatchObject({ vitaminD: { amount: 20 }, calcium: { amount: 1200 }, vitaminC: { amount: 90 } })
  })

  it('averages the equations and uses the higher reference intakes when sex is unspecified', () => {
    const profile = adultProfile({ sex: 'unspecified', heightCm: 170, activityLevel: 'sedentary', goal: 'general_wellness' })
    const result = calculateDailyTargets({ profile, date: TODAY })
    expect(result.estimate.bmrKcal).toBe(1530)
    expect(result.estimate.maintenanceKcal).toBe(1840)
    expect(result.targets.iron?.amount).toBe(18)
    expect(result.targets.vitaminC?.amount).toBe(90)
    expect(result.targets.potassium?.amount).toBe(3400)
    expect(result.assumptions).toContain('Sex isn’t specified, so the estimate averages the female and male equations.')
    expect(result.assumptions.some((a) => a.includes('higher of the female and male reference intakes'))).toBe(true)
  })

  it('prefers the latest weigh-in over the profile weight', () => {
    const fromProfile = calculateDailyTargets({ profile: adultProfile(), date: TODAY })
    const fromWeighIn = calculateDailyTargets({ profile: adultProfile(), date: TODAY, latestWeightKg: 80 })
    expect(fromWeighIn.estimate.bmrKcal).toBe(1520)
    expect(fromWeighIn.targets.protein?.amount).toBe(96)
    expect(fromWeighIn.targets.calories!.amount).toBeGreaterThan(fromProfile.targets.calories!.amount)
  })

  it.each([
    ['lose_weight', 'gentle', -220],
    ['lose_weight', 'moderate', -440],
    ['gain_weight', 'gentle', 220],
    ['gain_weight', 'moderate', 300],
    ['build_muscle', 'gentle', 220],
    ['build_muscle', 'moderate', 300],
    ['maintain', 'moderate', 0],
    ['general_wellness', 'moderate', 0],
  ] as const)('applies %s at a %s pace', (goal, goalPace, adjustment) => {
    const profile = adultProfile({ sex: 'male', currentWeightKg: 80, heightCm: 178, activityLevel: 'active', goal, goalPace })
    const result = calculateDailyTargets({ profile, date: TODAY })
    expect(result.estimate.goalAdjustmentKcal).toBe(adjustment)
    expect(result.targets.calories?.amount).toBe(result.estimate.maintenanceKcal + adjustment)
  })

  it('sets protein by goal', () => {
    const proteinFor = (goal: 'maintain' | 'lose_weight' | 'gain_weight' | 'build_muscle'): number | undefined =>
      calculateDailyTargets({ profile: adultProfile({ goal, sex: 'male', heightCm: 180 }), date: TODAY }).targets.protein?.amount
    expect(proteinFor('maintain')).toBe(84)
    expect(proteinFor('lose_weight')).toBe(112)
    expect(proteinFor('gain_weight')).toBe(98)
    expect(proteinFor('build_muscle')).toBe(126)
  })

  it('applies the calorie floor and never goes above maintenance', () => {
    const small = adultProfile({ birthDate: '1981-03-01', heightCm: 155, currentWeightKg: 50, activityLevel: 'sedentary', goal: 'lose_weight', goalPace: 'moderate' })
    const floored = calculateDailyTargets({ profile: small, date: TODAY })
    expect(floored.estimate.maintenanceKcal).toBe(1300)
    expect(floored.targets.calories?.amount).toBe(1200)

    const smaller = adultProfile({ birthDate: '1956-01-01', heightCm: 150, currentWeightKg: 45, activityLevel: 'sedentary', goal: 'lose_weight' })
    const atMaintenance = calculateDailyTargets({ profile: smaller, date: TODAY })
    expect(atMaintenance.estimate.maintenanceKcal).toBe(1050)
    expect(atMaintenance.targets.calories?.amount).toBe(1050)
    expect(atMaintenance.estimate.goalAdjustmentKcal).toBe(0)
  })

  it('makes no adjustment when the target weight is already reached', () => {
    const profile = adultProfile({ goal: 'lose_weight', targetWeightKg: 72 })
    const result = calculateDailyTargets({ profile, date: TODAY })
    expect(result.estimate.goalAdjustmentKcal).toBe(0)
    expect(result.assumptions).toContain('You’ve reached your target weight, so energy is set for maintenance.')
  })

  it('treats an 18-year-old as an adult with teen macronutrient ranges', () => {
    const profile = adultProfile({ birthDate: '2008-01-01', goal: 'lose_weight' })
    const result = calculateDailyTargets({ profile, date: TODAY })
    expect(result.mode).toBe('personalized')
    expect(result.estimate.goalAdjustmentKcal).toBeLessThan(0)
    expect(result.targets.iron?.amount).toBe(15)
    const kcal = result.targets.calories!.amount
    expect(result.targets.protein?.max).toBe(Math.round((kcal * 0.3) / 4))
  })

  it('explains every number in short assumptions', () => {
    const { assumptions } = calculateDailyTargets({ profile: adultProfile(), date: TODAY })
    expect(assumptions[0]).toMatch(/^Maintenance of about 1,950 kcal\/day .*Mifflin-St Jeor.*lightly active.*× 1\.375/)
    expect(assumptions).toContain('Protein: 1.2 g per kg of body weight.')
    expect(assumptions).toContain('Fiber: 14 g per 1,000 kcal of your energy target.')
    expect(assumptions.some((a) => a.startsWith('Limits: sodium up to 2,300 mg'))).toBe(true)
    expect(assumptions.join(' ')).not.toMatch(/\b(bad|cheat|failure|burn off|earn|guilt|compensate)\b/i)
  })
})

describe('calculateDailyTargets — minors', () => {
  const teen = adultProfile({ birthDate: '2010-06-01', heightCm: 160, currentWeightKg: 55, goal: 'lose_weight', goalPace: 'moderate' })

  it('gives general wellness targets with no weight-change adjustment', () => {
    const result = calculateDailyTargets({ profile: teen, date: TODAY })
    expect(result.mode).toBe('general')
    expect(result.estimate).toEqual({ method: 'population_default', bmrKcal: null, maintenanceKcal: 2000, goalAdjustmentKcal: 0 })
    expect(result.targets.calories?.amount).toBe(2000)
    expect(result.assumptions[0]).toBe(MINOR_NOTE)
    expect(result.assumptions.join(' ')).not.toMatch(/deficit|surplus/)
  })

  it('uses 14–18 reference values and the teen protein RDA within the teen AMDR', () => {
    const t = calculateDailyTargets({ profile: teen, date: TODAY }).targets
    expect(t.iron?.amount).toBe(15)
    expect(t.calcium).toEqual({ amount: 1300, min: null, max: 3000, kind: 'goal' })
    expect(t.vitaminC).toEqual({ amount: 65, min: null, max: 1800, kind: 'goal' })
    expect(t.potassium?.amount).toBe(2300)
    expect(t.protein).toEqual({ amount: 50, min: 50, max: 150, kind: 'goal' })
    expect(calculateDailyTargets({ profile: teen, date: TODAY }).assumptions).toContain(
      'Protein: 0.85 g per kg of body weight (the reference intake for ages 14–18), adjusted to stay within 10–30 % of energy.',
    )
    expect(t.fat).toEqual({ amount: 67, min: 56, max: 78, kind: 'goal' })
    expect(t.carbs?.amount).toBe(300)
    const boy = calculateDailyTargets({ profile: { ...teen, sex: 'male', currentWeightKg: 70 }, date: TODAY }).targets
    expect(boy.iron?.amount).toBe(11)
    expect(boy.protein?.amount).toBe(60)
  })

  it('does not apply keto to under-18s', () => {
    const result = calculateDailyTargets({ profile: { ...teen, dietType: 'keto' }, date: TODAY })
    expect(result.targets.carbs?.kind).toBe('goal')
    expect(result.targets.carbs?.amount).toBe(300)
    expect(result.assumptions).toContain('Keto targets aren’t set for people under 18, so balanced targets are shown.')
  })
})
