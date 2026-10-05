import type { DietType, FoodItem } from '@/types'
import { KCAL_PER_GRAM, isKnownAmount } from '../nutrition'
import { NEUTRAL_SUBSCORE } from './constants'
import { memoize } from './memo'

/**
 * How a diet pattern shapes suggestions. Add a rule here when a new `DietType` is introduced
 * (the exhaustive record makes the compiler ask for it).
 */
export interface DietRule {
  /** Hard constraint: false removes the food from the candidate pool. */
  isCompatible: (food: FoodItem) => boolean
  /** Soft emphasis 0–1 used by the preference dimension (0.5 = neutral). */
  emphasis: (food: FoodItem) => number
  /**
   * Soft preference for composing options: foods that fail stay candidates, but options are built from foods
   * that pass whenever any do (see `optionPool`).
   */
  suitsOptions: (food: FoodItem) => boolean
}

/**
 * Keto: full emphasis at ≤ 10 g net carbohydrate per 100 g, none from 25 g (breads, rice, pasta, cereals, dates).
 * Options are composed from the preferred foods (≤ 10 g per 100 g) while any remain, which keeps starchy legumes
 * and grains out of keto plates.
 */
export const KETO_NET_CARBS_G = { preferred: 10, none: 25 } as const

/** High-protein: emphasis grows from 10 % of energy as protein to full at 40 %. */
export const HIGH_PROTEIN_ENERGY_SHARE = { from: 0.1, full: 0.4 } as const

/** Mediterranean: foods tagged `mediterranean` get full emphasis, others a quarter. */
const MEDITERRANEAN_UNTAGGED = 0.25

const neutral = (): number => NEUTRAL_SUBSCORE
const anyFood = (): boolean => true

/** 0 at `from`, 1 at `to` (from < to), linear between. */
function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)))
}

/** Net carbohydrate per 100 g (carbohydrate − fiber; fiber unknown → total carbohydrate); null when carbs unknown. */
export function netCarbsPer100g(food: FoodItem): number | null {
  const { carbs, fiber } = food.per100g
  if (!isKnownAmount(carbs)) return null
  return Math.max(0, carbs - (isKnownAmount(fiber) ? fiber : 0))
}

/** Share of a food's energy that comes from protein (0 when energy or protein is unknown or zero). */
export const proteinEnergyShare = memoize((food: FoodItem): number => {
  const { calories, protein } = food.per100g
  if (!isKnownAmount(calories) || !isKnownAmount(protein) || calories <= 0) return 0
  return Math.min(1, (protein * KCAL_PER_GRAM.protein) / calories)
})

function ketoEmphasis(food: FoodItem): number {
  const net = netCarbsPer100g(food)
  if (net === null) return 0
  return 1 - ramp(net, KETO_NET_CARBS_G.preferred, KETO_NET_CARBS_G.none)
}

function ketoSuitsOptions(food: FoodItem): boolean {
  const net = netCarbsPer100g(food)
  return net !== null && net <= KETO_NET_CARBS_G.preferred
}

export const DIET_RULES: Readonly<Record<DietType, DietRule>> = {
  balanced: { isCompatible: anyFood, emphasis: neutral, suitsOptions: anyFood },
  vegetarian: { isCompatible: (food) => food.dietFlags.vegetarian === true, emphasis: neutral, suitsOptions: anyFood },
  vegan: { isCompatible: (food) => food.dietFlags.vegan === true, emphasis: neutral, suitsOptions: anyFood },
  keto: { isCompatible: anyFood, emphasis: memoize(ketoEmphasis), suitsOptions: memoize(ketoSuitsOptions) },
  mediterranean: {
    isCompatible: anyFood,
    emphasis: (food) => (food.tags.includes('mediterranean') ? 1 : MEDITERRANEAN_UNTAGGED),
    suitsOptions: anyFood,
  },
  high_protein: {
    isCompatible: anyFood,
    emphasis: memoize((food: FoodItem) => ramp(proteinEnergyShare(food), HIGH_PROTEIN_ENERGY_SHARE.from, HIGH_PROTEIN_ENERGY_SHARE.full)),
    suitsOptions: anyFood,
  },
}

export function dietRule(diet: DietType): DietRule {
  return DIET_RULES[diet]
}

/** Foods options are composed from: those that suit the diet's options, or every food when none does. */
export function optionPool(foods: readonly FoodItem[], diet: DietType): readonly FoodItem[] {
  const suits = dietRule(diet).suitsOptions
  const preferred = foods.filter(suits)
  return preferred.length > 0 ? preferred : foods
}
