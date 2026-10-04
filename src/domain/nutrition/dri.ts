import type { MicroKey, Sex } from '@/types'

/*
 * Micronutrient Dietary Reference Intakes (NASEM DRI Summary Tables, Appendix J of the 2019 Sodium &
 * Potassium report; cross-checked with Health Canada DRI tables). Values are RDAs except potassium (AI, 2019).
 * 19–30 and 31–50 share every value used here, so they form one band.
 */

export const AGE_BANDS = ['14-18', '19-50', '51-70', '71+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

/** Shown in assumptions, e.g. "ages 19–50". */
export const AGE_BAND_LABELS: Readonly<Record<AgeBand, string>> = {
  '14-18': 'ages 14–18',
  '19-50': 'ages 19–50',
  '51-70': 'ages 51–70',
  '71+': 'ages 71 and over',
}

/** Band used when the age is unknown. */
export const DEFAULT_AGE_BAND: AgeBand = '19-50'

/**
 * Age band for reference intakes. Everyone under 19 uses the 14–18 values (the app does not model
 * younger children separately); unknown age uses the adult 19–50 values.
 */
export function ageBandFor(ageYears: number | null): AgeBand {
  if (ageYears === null) return DEFAULT_AGE_BAND
  if (ageYears < 19) return '14-18'
  if (ageYears <= 50) return '19-50'
  if (ageYears <= 70) return '51-70'
  return '71+'
}

/** [female, male] per band, in the nutrient's unit (mg; vitamin D µg). */
type SexPair = readonly [female: number, male: number]

export const REFERENCE_INTAKES: Readonly<Record<MicroKey, Readonly<Record<AgeBand, SexPair>>>> = {
  iron: { '14-18': [15, 11], '19-50': [18, 8], '51-70': [8, 8], '71+': [8, 8] },
  calcium: { '14-18': [1300, 1300], '19-50': [1000, 1000], '51-70': [1200, 1000], '71+': [1200, 1200] },
  vitaminC: { '14-18': [65, 75], '19-50': [75, 90], '51-70': [75, 90], '71+': [75, 90] },
  vitaminD: { '14-18': [15, 15], '19-50': [15, 15], '51-70': [15, 15], '71+': [20, 20] },
  potassium: { '14-18': [2300, 3000], '19-50': [2600, 3400], '51-70': [2600, 3400], '71+': [2600, 3400] },
}

/**
 * Tolerable Upper Intake Levels (same for both sexes; total from food and supplements). Potassium has no
 * UL. Food alone rarely reaches these — they are informational ceilings, never alarms.
 */
export const UPPER_LIMITS: Readonly<Record<MicroKey, Readonly<Record<AgeBand, number>> | null>> = {
  iron: { '14-18': 45, '19-50': 45, '51-70': 45, '71+': 45 },
  calcium: { '14-18': 3000, '19-50': 2500, '51-70': 2000, '71+': 2000 },
  vitaminC: { '14-18': 1800, '19-50': 2000, '51-70': 2000, '71+': 2000 },
  vitaminD: { '14-18': 100, '19-50': 100, '51-70': 100, '71+': 100 },
  potassium: null,
}

/** Iron requirement multiplier for vegetarian and vegan eating (NASEM / Health Canada footnote: × 1.8). */
export const PLANT_BASED_IRON_FACTOR = 1.8

/**
 * Reference intake for one nutrient. `unspecified` sex uses the HIGHER of the female and male values
 * (app convention: a target that covers either reference).
 */
export function referenceIntake(key: MicroKey, band: AgeBand, sex: Sex): number {
  const [female, male] = REFERENCE_INTAKES[key][band]
  if (sex === 'female') return female
  if (sex === 'male') return male
  return Math.max(female, male)
}

export function upperLimit(key: MicroKey, band: AgeBand): number | null {
  return UPPER_LIMITS[key]?.[band] ?? null
}
