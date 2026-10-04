import type { DietType } from '@/types'
import type { ShareRange } from './constants'

/** Percent-of-energy range with the point the target aims for. */
export interface ShareTarget extends ShareRange {
  target: number
}

export interface GramRange {
  target: number
  min: number
  max: number
}

/**
 * How a diet pattern splits energy between macronutrients.
 * - protein.target is used only when body weight is unknown (otherwise protein comes from g/kg).
 * - carbs: 'remainder' → energy left after protein and fat; a GramRange → fixed grams (keto).
 * - fat for keto is the remainder; its range is used as the comfortable band.
 */
export interface DietDistribution {
  /** Name of the macro split in assumption sentences. */
  label: string
  protein: ShareTarget
  fat: ShareTarget
  carbs: { kind: 'remainder'; range: ShareRange } | { kind: 'grams'; grams: GramRange }
}

const AMDR_CARBS: ShareRange = { min: 45, max: 65 }

/**
 * Diet macro distributions (app conventions; NASEM AMDR for every pattern except keto).
 * - balanced: fat 30 %, carbohydrate the remainder (45–65 %).
 * - high_protein: protein ≥ 1.8 g/kg (ISSN 2017; ACSM 2016), fat 30 %, carbohydrate the remainder.
 * - mediterranean: fat 35 % — the AMDR ceiling — emphasising olive oil, nuts and fish.
 * - vegetarian / vegan: balanced split; micronutrient adjustments live in `micronutrients.ts`.
 * - keto: carbohydrate 20–50 g/day aiming for 30 g; fat 55–80 % as the remainder (StatPearls "The Ketogenic
 *   Diet", PMID 29763005: 20–50 g carbohydrate, 60–75 % of calories from fat). Not applied to under-18s.
 */
export const DIET_DISTRIBUTIONS: Readonly<Record<DietType, DietDistribution>> = {
  balanced: {
    label: 'balanced',
    protein: { min: 10, target: 20, max: 35 },
    fat: { min: 20, target: 30, max: 35 },
    carbs: { kind: 'remainder', range: AMDR_CARBS },
  },
  high_protein: {
    label: 'high-protein',
    protein: { min: 10, target: 30, max: 35 },
    fat: { min: 20, target: 30, max: 35 },
    carbs: { kind: 'remainder', range: AMDR_CARBS },
  },
  mediterranean: {
    label: 'Mediterranean',
    protein: { min: 10, target: 20, max: 35 },
    fat: { min: 25, target: 35, max: 35 },
    carbs: { kind: 'remainder', range: AMDR_CARBS },
  },
  vegetarian: {
    label: 'balanced',
    protein: { min: 10, target: 20, max: 35 },
    fat: { min: 20, target: 30, max: 35 },
    carbs: { kind: 'remainder', range: AMDR_CARBS },
  },
  vegan: {
    label: 'balanced',
    protein: { min: 10, target: 20, max: 35 },
    fat: { min: 20, target: 30, max: 35 },
    carbs: { kind: 'remainder', range: AMDR_CARBS },
  },
  keto: {
    label: 'keto',
    protein: { min: 10, target: 20, max: 35 },
    fat: { min: 55, target: 70, max: 80 },
    carbs: { kind: 'grams', grams: { target: 30, min: 20, max: 50 } },
  },
}

/** Diets whose iron target is raised: plant (non-heme) iron is absorbed less (NASEM: requirement × 1.8). */
export const PLANT_BASED_DIETS: readonly DietType[] = ['vegetarian', 'vegan']
