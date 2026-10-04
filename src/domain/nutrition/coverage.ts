import { MICRO_KEYS, type FoodPortion, type NutrientTotals } from '@/types'
import { clamp } from './format'
import { isKnownAmount } from './portion'
import type { DailyTargets, MicronutrientCoverage, MicronutrientCoverageItem } from './types'

/** Number of items behind the totals (every item counts once per nutrient, known or missing). */
function loggedItemCount(totals: NutrientTotals): number {
  return Math.max(...MICRO_KEYS.map((key) => totals[key].knownCount + totals[key].missingCount))
}

/**
 * Share of items reporting every micronutrient. Exact when `items` are given; otherwise derived from the
 * per-nutrient counts as a guaranteed lower bound (exact when at most one micronutrient has gaps).
 */
function completeness(totals: NutrientTotals, itemCount: number, items?: ReadonlyArray<Pick<FoodPortion, 'per100g'>>): number {
  if (items && items.length > 0) {
    const complete = items.filter((item) => MICRO_KEYS.every((key) => isKnownAmount(item.per100g[key]))).length
    return complete / items.length
  }
  const missing = MICRO_KEYS.reduce((sum, key) => sum + totals[key].missingCount, 0)
  return Math.max(0, itemCount - missing) / itemCount
}

/**
 * Micronutrient coverage for the day (iron, calcium, vitamin C, vitamin D, potassium) — transparent about
 * missing data: each item says whether every logged food reported the nutrient, and `dataCompleteness`
 * tells how much of the log has full micronutrient data. Ratios are clamped to [0, 1]; nutrients without
 * a positive target are skipped. `overall` and `dataCompleteness` are null when nothing is logged.
 * Pass the day's `items` (e.g. meal entries) for an exact `dataCompleteness`.
 */
export function micronutrientCoverage(
  targets: DailyTargets,
  totals: NutrientTotals,
  items?: ReadonlyArray<Pick<FoodPortion, 'per100g'>>,
): MicronutrientCoverage {
  const coverageItems: MicronutrientCoverageItem[] = []
  for (const key of MICRO_KEYS) {
    const target = targets.targets[key]
    if (!target || target.amount <= 0) continue
    const total = totals[key]
    coverageItems.push({
      key,
      consumed: total.value,
      target: target.amount,
      ratio: clamp(total.value / target.amount, 0, 1),
      dataComplete: total.missingCount === 0,
    })
  }

  const itemCount = loggedItemCount(totals)
  if (itemCount === 0) return { items: coverageItems, overall: null, dataCompleteness: null }
  const overall =
    coverageItems.length > 0 ? coverageItems.reduce((sum, item) => sum + item.ratio, 0) / coverageItems.length : null
  return { items: coverageItems, overall, dataCompleteness: completeness(totals, itemCount, items) }
}
