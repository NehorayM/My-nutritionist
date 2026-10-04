import type { DietType, WellnessGoal } from '@/types'
import {
  AMDR,
  HIGH_PROTEIN_G_PER_KG,
  KCAL_PER_GRAM,
  MINOR_PROTEIN_G_PER_KG,
  PROTEIN_G_PER_KG,
  type ShareRange,
} from './constants'
import { DIET_DISTRIBUTIONS, type ShareTarget } from './diets'
import { clamp, formatAmount, roundWhole } from './format'
import type { NutrientTarget } from './types'

export interface MacroInput {
  energyKcal: number
  weightKg: number | null
  /** Under-18s use the teen AMDR and the protein RDA. */
  minor: boolean
  /** Age 14–18 (teen AMDR applies, including 18-year-olds). */
  teenAmdr: boolean
  goal: WellnessGoal
  diet: DietType
}

export interface MacroTargets {
  protein: NutrientTarget
  carbs: NutrientTarget
  fat: NutrientTarget
  notes: string[]
}

/** Protein g/kg: RDA for under-18s; by goal for adults, at least 1.8 on a high-protein diet. */
export function proteinGramsPerKg(goal: WellnessGoal, diet: DietType, minor: boolean): number {
  if (minor) return MINOR_PROTEIN_G_PER_KG
  const byGoal = PROTEIN_G_PER_KG[goal]
  return diet === 'high_protein' ? Math.max(byGoal, HIGH_PROTEIN_G_PER_KG) : byGoal
}

function gramsOf(sharePct: number, energyKcal: number, kcalPerGram: number): number {
  return (energyKcal * sharePct) / 100 / kcalPerGram
}

/** Intersect a diet range with the age-appropriate AMDR, keeping the target inside. */
function withinRange(diet: ShareTarget, amdr: ShareRange): ShareTarget {
  const min = Math.max(diet.min, amdr.min)
  const max = Math.min(diet.max, amdr.max)
  return { min, max, target: clamp(diet.target, min, max) }
}

/** Goal target whose range always contains the amount (all values rounded to whole grams). */
function goalTarget(amount: number, rangeMin: number, rangeMax: number): NutrientTarget {
  const rounded = roundWhole(amount)
  return {
    amount: rounded,
    min: Math.min(roundWhole(rangeMin), rounded),
    max: Math.max(roundWhole(rangeMax), rounded),
    kind: 'goal',
  }
}

/**
 * Macro targets: protein from g/kg (or the diet's share when weight is unknown) clamped to the AMDR;
 * carbohydrate and fat from the diet distribution. For non-keto diets fat moves within its range to keep
 * carbohydrate inside 45–65 % where possible. Keto: carbohydrate is a fixed-gram limit, fat the remainder.
 * @throws RangeError when energyKcal is not a positive finite number.
 */
export function macroTargets(input: MacroInput): MacroTargets {
  const { energyKcal: kcal, weightKg, minor, goal } = input
  if (!Number.isFinite(kcal) || kcal <= 0) throw new RangeError(`energyKcal must be a positive number (got ${kcal})`)
  const dist = DIET_DISTRIBUTIONS[input.diet]
  const amdr = input.teenAmdr ? AMDR.teen : AMDR.adult
  const notes: string[] = []

  const proteinMin = gramsOf(amdr.protein.min, kcal, KCAL_PER_GRAM.protein)
  const proteinMax = gramsOf(amdr.protein.max, kcal, KCAL_PER_GRAM.protein)
  const amdrText = `${amdr.protein.min}–${amdr.protein.max} % of energy`
  let proteinG: number
  if (weightKg === null) {
    proteinG = gramsOf(clamp(dist.protein.target, amdr.protein.min, amdr.protein.max), kcal, KCAL_PER_GRAM.protein)
    notes.push(`Protein is ${formatAmount((proteinG * KCAL_PER_GRAM.protein * 100) / kcal)} % of energy until your weight is added.`)
  } else {
    const perKg = proteinGramsPerKg(goal, input.diet, minor)
    const raw = perKg * weightKg
    proteinG = clamp(raw, proteinMin, proteinMax)
    const basis = minor ? ' (the reference intake for ages 14–18)' : ''
    notes.push(
      proteinG === raw
        ? `Protein: ${formatAmount(perKg, 2)} g per kg of body weight${basis}.`
        : `Protein: ${formatAmount(perKg, 2)} g per kg of body weight${basis}, adjusted to stay within ${amdrText}.`,
    )
  }
  const protein = goalTarget(proteinG, proteinMin, proteinMax)
  const proteinKcal = protein.amount * KCAL_PER_GRAM.protein

  if (dist.carbs.kind === 'grams') {
    const carbs = dist.carbs.grams
    const fatG = Math.max(0, kcal - proteinKcal - carbs.target * KCAL_PER_GRAM.carbs) / KCAL_PER_GRAM.fat
    notes.push(
      `Keto: carbohydrate up to ${carbs.max} g/day (aiming for ${carbs.target} g); fat makes up the rest of your energy.`,
      'Keto sits outside general macronutrient guidelines. If you have a medical condition or take glucose-lowering medication, check with a healthcare professional first.',
    )
    return {
      protein,
      carbs: { amount: carbs.target, min: carbs.min, max: carbs.max, kind: 'limit' },
      fat: goalTarget(fatG, gramsOf(dist.fat.min, kcal, KCAL_PER_GRAM.fat), gramsOf(dist.fat.max, kcal, KCAL_PER_GRAM.fat)),
      notes,
    }
  }

  const fatRange = withinRange(dist.fat, amdr.fat)
  const carbRange = dist.carbs.range
  const proteinShare = (proteinKcal * 100) / kcal
  // Higher protein leaves less room for carbohydrate: give way on fat (down to its minimum) first.
  const carbShortfall = Math.max(0, carbRange.min - (100 - proteinShare - fatRange.target))
  const fatShare = Math.max(fatRange.min, fatRange.target - carbShortfall)
  const carbShare = Math.max(0, 100 - proteinShare - fatShare)

  notes.push(`Carbohydrate and fat follow a ${dist.label} split: about ${formatAmount(fatShare)} % of energy from fat, the rest from carbohydrate.`)
  return {
    protein,
    carbs: goalTarget(
      gramsOf(carbShare, kcal, KCAL_PER_GRAM.carbs),
      gramsOf(carbRange.min, kcal, KCAL_PER_GRAM.carbs),
      gramsOf(carbRange.max, kcal, KCAL_PER_GRAM.carbs),
    ),
    fat: goalTarget(
      gramsOf(fatShare, kcal, KCAL_PER_GRAM.fat),
      gramsOf(fatRange.min, kcal, KCAL_PER_GRAM.fat),
      gramsOf(fatRange.max, kcal, KCAL_PER_GRAM.fat),
    ),
    notes,
  }
}
