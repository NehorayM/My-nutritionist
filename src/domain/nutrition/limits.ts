import type { DietType } from '@/types'
import { FIBER_G_PER_1000_KCAL, KCAL_PER_GRAM, KETO_FIBER_CAP_G, SATURATED_FAT_MAX_SHARE, SODIUM_LIMIT_MG } from './constants'
import { formatAmount, roundWhole } from './format'
import type { NutrientTarget } from './types'

export interface TargetWithNote {
  target: NutrientTarget
  note: string
}

/**
 * Fiber goal: 14 g per 1,000 kcal of the energy target. Keto caps it at 20 g because total carbohydrate,
 * which includes fiber, stays at or below 50 g.
 */
export function fiberTarget(energyKcal: number, diet: DietType): TargetWithNote {
  const byEnergy = roundWhole((FIBER_G_PER_1000_KCAL * energyKcal) / 1000)
  if (diet === 'keto' && byEnergy > KETO_FIBER_CAP_G) {
    return {
      target: { amount: KETO_FIBER_CAP_G, min: null, max: null, kind: 'goal' },
      note: `Fiber: ${KETO_FIBER_CAP_G} g on keto, since total carbohydrate (which includes fiber) stays low.`,
    }
  }
  return {
    target: { amount: byEnergy, min: null, max: null, kind: 'goal' },
    note: `Fiber: ${FIBER_G_PER_1000_KCAL} g per 1,000 kcal of your energy target.`,
  }
}

export interface LimitTargets {
  sodium: NutrientTarget
  saturatedFat: NutrientTarget
  note: string
}

/**
 * Limits (kind 'limit', amount = max): sodium below 2,300 mg/day; saturated fat below 10 % of energy.
 * Total sugars get no target — guidelines address added sugars, which food data cannot separate.
 */
export function limitTargets(energyKcal: number): LimitTargets {
  const saturatedFatMax = roundWhole((energyKcal * SATURATED_FAT_MAX_SHARE) / KCAL_PER_GRAM.fat)
  return {
    sodium: { amount: SODIUM_LIMIT_MG, min: null, max: SODIUM_LIMIT_MG, kind: 'limit' },
    saturatedFat: { amount: saturatedFatMax, min: null, max: saturatedFatMax, kind: 'limit' },
    note: `Limits: sodium up to ${formatAmount(SODIUM_LIMIT_MG)} mg and saturated fat under ${SATURATED_FAT_MAX_SHARE * 100} % of energy. Sugars are shown for information without a target.`,
  }
}
