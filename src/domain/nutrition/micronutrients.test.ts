import { describe, expect, it } from 'vitest'
import { MICRO_KEYS } from '@/types'
import { AGE_BANDS, ageBandFor, referenceIntake, upperLimit } from './dri'
import { clamp, formatAmount, roundKcal, roundTenth } from './format'
import { micronutrientTargets } from './micronutrients'

describe('ageBandFor', () => {
  it.each([
    [null, '19-50'],
    [10, '14-18'],
    [16, '14-18'],
    [18, '14-18'],
    [19, '19-50'],
    [50, '19-50'],
    [51, '51-70'],
    [70, '51-70'],
    [71, '71+'],
    [99, '71+'],
  ] as const)('maps age %s to band %s', (age, band) => {
    expect(ageBandFor(age)).toBe(band)
  })
})

describe('referenceIntake by age group and sex', () => {
  it.each([
    ['iron', '14-18', 15, 11],
    ['iron', '19-50', 18, 8],
    ['iron', '51-70', 8, 8],
    ['calcium', '14-18', 1300, 1300],
    ['calcium', '19-50', 1000, 1000],
    ['calcium', '51-70', 1200, 1000],
    ['calcium', '71+', 1200, 1200],
    ['vitaminC', '14-18', 65, 75],
    ['vitaminC', '71+', 75, 90],
    ['vitaminD', '51-70', 15, 15],
    ['vitaminD', '71+', 20, 20],
    ['potassium', '14-18', 2300, 3000],
    ['potassium', '51-70', 2600, 3400],
  ] as const)('%s for %s: female %s, male %s', (key, band, female, male) => {
    expect(referenceIntake(key, band, 'female')).toBe(female)
    expect(referenceIntake(key, band, 'male')).toBe(male)
    expect(referenceIntake(key, band, 'unspecified')).toBe(Math.max(female, male))
  })

  it('has positive values for every micronutrient, band and sex', () => {
    for (const key of MICRO_KEYS) {
      for (const band of AGE_BANDS) {
        for (const sex of ['female', 'male', 'unspecified'] as const) expect(referenceIntake(key, band, sex)).toBeGreaterThan(0)
      }
    }
  })
})

describe('upperLimit', () => {
  it('returns the UL for the band, or null when none is set (potassium)', () => {
    expect(upperLimit('calcium', '14-18')).toBe(3000)
    expect(upperLimit('calcium', '51-70')).toBe(2000)
    expect(upperLimit('vitaminC', '14-18')).toBe(1800)
    expect(upperLimit('iron', '71+')).toBe(45)
    expect(upperLimit('vitaminD', '19-50')).toBe(100)
    expect(upperLimit('potassium', '19-50')).toBeNull()
  })
})

describe('micronutrientTargets', () => {
  it('builds goal targets with upper limits as max', () => {
    const { targets, notes } = micronutrientTargets('71+', 'male', 'balanced')
    expect(targets.vitaminD).toEqual({ amount: 20, min: null, max: 100, kind: 'goal' })
    expect(targets.calcium).toEqual({ amount: 1200, min: null, max: 2000, kind: 'goal' })
    expect(targets.potassium.max).toBeNull()
    expect(notes).toEqual(['Vitamin and mineral targets use reference intakes for men, ages 71 and over.'])
  })

  it('names the group for teens and adults of each sex', () => {
    expect(micronutrientTargets('14-18', 'female', 'balanced').notes[0]).toMatch(/for girls, ages 14–18/)
    expect(micronutrientTargets('14-18', 'male', 'balanced').notes[0]).toMatch(/for boys, ages 14–18/)
    expect(micronutrientTargets('51-70', 'female', 'balanced').notes[0]).toMatch(/for women, ages 51–70/)
    expect(micronutrientTargets('14-18', 'unspecified', 'balanced').notes[0]).toMatch(/higher of the female and male .* ages 14–18/)
  })

  it('raises only the iron target for vegetarian and vegan eating', () => {
    const vegan = micronutrientTargets('14-18', 'female', 'vegan')
    expect(vegan.targets.iron.amount).toBe(27)
    expect(vegan.targets.calcium.amount).toBe(1300)
    expect(vegan.notes).toHaveLength(2)
    expect(micronutrientTargets('19-50', 'female', 'keto').targets.iron.amount).toBe(18)
  })
})

describe('format helpers', () => {
  it('rounds energy to 10 kcal', () => {
    expect(roundKcal(1952.84)).toBe(1950)
    expect(roundKcal(1755)).toBe(1760)
    expect(roundKcal(2144.9)).toBe(2140)
  })

  it('formats amounts without depending on the device locale', () => {
    expect(formatAmount(2000)).toBe('2,000')
    expect(formatAmount(1234567)).toBe('1,234,567')
    expect(formatAmount(1.6)).toBe('1.6')
    expect(formatAmount(29.8)).toBe('29.8')
    expect(formatAmount(16.84)).toBe('16.8')
    expect(formatAmount(0)).toBe('0')
    expect(formatAmount(999.96)).toBe('1,000')
    expect(formatAmount(0.85, 2)).toBe('0.85')
    expect(formatAmount(1.2, 2)).toBe('1.2')
    expect(formatAmount(1.05, 2)).toBe('1.05')
    expect(formatAmount(2.5, 0)).toBe('3')
  })

  it('rounds tenths and clamps', () => {
    expect(roundTenth(32.400000000000006)).toBe(32.4)
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
})
