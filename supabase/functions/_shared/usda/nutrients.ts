import { isRecord, readNumber, readRecord, readString, roundNutrient } from './guards.ts'
import { USDA_NUTRIENT_KEYS, type UsdaNutrientKey, type UsdaNutrientProfile } from './types.ts'

/**
 * FDC nutrient candidates per field, first present wins (research §A.5, verified on live responses).
 * Rows carry `nutrientId`/`nutrient.id` (search/full) or only `number` (abridged).
 */
interface Candidate {
  id: number
  number: string
}

export const FDC_NUTRIENT_CANDIDATES: Record<UsdaNutrientKey, readonly Candidate[]> = {
  // Energy (kcal) → Atwater specific → Atwater general → Energy (kJ, converted)
  calories: [
    { id: 1008, number: '208' },
    { id: 2048, number: '958' },
    { id: 2047, number: '957' },
    { id: 1062, number: '268' },
  ],
  protein: [{ id: 1003, number: '203' }],
  // Carbohydrate by difference (US "total carbohydrate", includes fiber) → by summation
  carbs: [
    { id: 1005, number: '205' },
    { id: 1050, number: '205.2' },
  ],
  fat: [
    { id: 1004, number: '204' },
    { id: 1085, number: '298' },
  ],
  fiber: [{ id: 1079, number: '291' }],
  sugars: [
    { id: 2000, number: '269' },
    { id: 1063, number: '269.3' },
  ],
  saturatedFat: [{ id: 1258, number: '606' }],
  sodium: [{ id: 1093, number: '307' }],
  potassium: [{ id: 1092, number: '306' }],
  calcium: [{ id: 1087, number: '301' }],
  iron: [{ id: 1089, number: '303' }],
  vitaminC: [{ id: 1162, number: '401' }],
  // Vitamin D (µg) → Vitamin D in IU (÷ 40)
  vitaminD: [
    { id: 1114, number: '328' },
    { id: 1110, number: '324' },
  ],
}

/** Nutrient NUMBERS for the `nutrients=` filter of GET /v1/food/{fdcId} (max 25 accepted upstream). */
export const FDC_NUTRIENT_NUMBERS: readonly string[] = USDA_NUTRIENT_KEYS.flatMap((key) =>
  FDC_NUTRIENT_CANDIDATES[key].map((candidate) => candidate.number),
)

type TargetUnit = 'kcal' | 'g' | 'mg' | 'µg'

const TARGET_UNITS: Record<UsdaNutrientKey, TargetUnit> = {
  calories: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  sugars: 'g',
  saturatedFat: 'g',
  sodium: 'mg',
  potassium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  vitaminC: 'mg',
  vitaminD: 'µg',
}

type SourceUnit = 'g' | 'mg' | 'µg' | 'kcal' | 'kj' | 'iu'

const GRAMS_PER_UNIT = { g: 1, mg: 1e-3, 'µg': 1e-6 } as const
export const KJ_PER_KCAL = 4.184
export const VITAMIN_D_IU_PER_UG = 40

/** FDC units: full "g|mg|µg|kcal|kJ|IU", search/abridged "G|MG|UG|KCAL|kJ|IU". Unknown → null (never guessed). */
export function normalizeUnit(raw: string | null): SourceUnit | null {
  if (raw === null) return null
  const unit = raw.trim().toLowerCase().replace('μ', 'µ')
  if (unit === 'g' || unit === 'gm' || unit === 'grm') return 'g'
  if (unit === 'mg') return 'mg'
  if (unit === 'ug' || unit === 'µg' || unit === 'mcg') return 'µg'
  if (unit === 'kcal') return 'kcal'
  if (unit === 'kj') return 'kj'
  if (unit === 'iu') return 'iu'
  return null
}

function convert(amount: number, unit: SourceUnit, key: UsdaNutrientKey): number | null {
  const target = TARGET_UNITS[key]
  if (target === 'kcal') {
    if (unit === 'kcal') return amount
    if (unit === 'kj') return amount / KJ_PER_KCAL
    return null
  }
  // Only vitamin D is reported in IU among our nutrients; its target unit is µg.
  if (unit === 'iu') return key === 'vitaminD' ? amount / VITAMIN_D_IU_PER_UG : null
  if (unit === 'kcal' || unit === 'kj') return null
  return (amount * GRAMS_PER_UNIT[unit]) / GRAMS_PER_UNIT[target]
}

export interface NutrientReading {
  id: number | null
  number: string | null
  amount: number
  unit: SourceUnit | null
}

/** Reads search (`nutrientId`/`value`), full (`nutrient{}`/`amount`) and abridged (`number`/`amount`) rows. */
export function readNutrientRows(rows: unknown[]): NutrientReading[] {
  const readings: NutrientReading[] = []
  for (const row of rows) {
    if (!isRecord(row)) continue
    const nested = readRecord(row, 'nutrient')
    const amount = readNumber(row, 'amount') ?? readNumber(row, 'value')
    // Group header rows in format=full (e.g. "Proximates") have no amount.
    if (amount === null || amount < 0) continue
    const id = nested ? readNumber(nested, 'id') : readNumber(row, 'nutrientId')
    const number = nested ? readString(nested, 'number') : (readString(row, 'nutrientNumber') ?? readString(row, 'number'))
    const unit = normalizeUnit(nested ? readString(nested, 'unitName') : readString(row, 'unitName'))
    readings.push({ id, number, amount, unit })
  }
  return readings
}

/** Physical upper bounds per 100 g (and the food_items CHECK limits); larger values are data errors. */
export function isPlausible(key: UsdaNutrientKey, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false
  if (key === 'calories') return value <= 1000
  if (TARGET_UNITS[key] === 'g') return value <= 100
  return value <= 100_000
}

function matches(reading: NutrientReading, candidate: Candidate): boolean {
  if (reading.id !== null) return reading.id === candidate.id
  return reading.number === candidate.number
}

/** Per-100 g profile from FDC rows. Absent nutrient → null; a reported 0 stays 0. */
export function mapFdcNutrients(readings: NutrientReading[]): UsdaNutrientProfile {
  const profile = {} as UsdaNutrientProfile
  for (const key of USDA_NUTRIENT_KEYS) {
    profile[key] = null
    for (const candidate of FDC_NUTRIENT_CANDIDATES[key]) {
      const reading = readings.find((r) => matches(r, candidate) && r.unit !== null)
      if (!reading || reading.unit === null) continue
      const value = convert(reading.amount, reading.unit, key)
      if (value === null || !isPlausible(key, value)) continue
      profile[key] = roundNutrient(value)
      break
    }
  }
  return profile
}

/** True when at least one of calories/protein/carbs/fat is known. */
export function hasCoreNutrient(profile: UsdaNutrientProfile): boolean {
  return profile.calories !== null || profile.protein !== null || profile.carbs !== null || profile.fat !== null
}
