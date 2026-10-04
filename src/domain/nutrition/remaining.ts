import { MICRO_KEYS, NUTRIENT_KEYS, type NutrientKey } from '@/types'
import { GAP_MIN_REMAINING_SHARE, NUMERIC_TOLERANCE } from './constants'
import { remainingMealSlots } from './remainingMeals'
import { nutrientStatus } from './status'
import type { RemainingInput, RemainingNutrient, RemainingNutrition } from './types'

/** Goal nutrients that can be reported as gaps (carbohydrate and fat are covered by energy). */
export const GAP_KEYS: readonly NutrientKey[] = ['protein', 'fiber', ...MICRO_KEYS]

function isGap(item: RemainingNutrient): boolean {
  return (
    GAP_KEYS.includes(item.key) &&
    item.status === 'under' &&
    item.remaining + NUMERIC_TOLERANCE >= item.target.amount * GAP_MIN_REMAINING_SHARE
  )
}

function isSurplus(item: RemainingNutrient): boolean {
  return item.status === 'over' && (item.target.kind === 'energy' || item.target.kind === 'limit')
}

/**
 * Remaining Nutrition Engine. For every nutrient with a target: consumed total, remaining
 * (target − consumed, negative = above target), progress (consumed / target, unclamped; 0 when the target
 * is 0), status (see `nutrientStatus`) and whether data is complete.
 * - gaps: protein, fiber and micronutrients still "under" with ≥ 20 % of the target to go.
 * - surpluses: energy above its range and limit nutrients above their limit.
 * - remainingMeals: see `remainingMealSlots`.
 */
export function calculateRemaining({ targets, totals, entries, now, date }: RemainingInput): RemainingNutrition {
  const byNutrient: RemainingNutrition['byNutrient'] = {}
  const items: RemainingNutrient[] = []
  for (const key of NUTRIENT_KEYS) {
    const target = targets.targets[key]
    if (!target) continue
    const consumed = totals[key]
    const item: RemainingNutrient = {
      key,
      target,
      consumed,
      remaining: target.amount - consumed.value,
      progress: target.amount > 0 ? consumed.value / target.amount : 0,
      status: nutrientStatus(target, consumed),
      dataComplete: consumed.missingCount === 0,
    }
    byNutrient[key] = item
    items.push(item)
  }

  return {
    byNutrient,
    remainingMeals: remainingMealSlots(entries, now, date),
    gaps: items.filter(isGap).map((item) => item.key),
    surpluses: items.filter(isSurplus).map((item) => item.key),
  }
}
