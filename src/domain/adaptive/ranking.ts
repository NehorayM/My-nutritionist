import type { NutrientProfile } from '@/types'
import { sumNutrientProfiles, totalsToProfile } from '../nutrition'
import { energyShares, practicalityScore, preferenceScore, varietyScore } from './behaviorFit'
import { RANKING_WEIGHTS } from './constants'
import type { RankingContext } from './context'
import { calorieFitScore, fiberScore, macroFitScore, micronutrientScore, type ScoredItem } from './nutritionFit'
import type { ScoreBreakdown } from './types'

export interface ScoredOption {
  /** Sum of the breakdown. */
  score: number
  /** Weighted contribution of each dimension (sub-score × weight). */
  breakdown: ScoreBreakdown
}

/**
 * Option totals: known values summed per nutrient; null only when no component knows the nutrient. A single
 * component's totals are its own nutrients (half of all evaluated options are single foods).
 */
export function optionTotals(items: readonly Pick<ScoredItem, 'nutrients'>[]): NutrientProfile {
  const [only] = items
  if (only && items.length === 1) return { ...only.nutrients }
  return totalsToProfile(sumNutrientProfiles(items.map((item) => item.nutrients)))
}

/** Unweighted 0–1 sub-scores of an option (see `RANKING_WEIGHTS` for how they combine). */
export function subScores(items: readonly ScoredItem[], ctx: RankingContext): ScoreBreakdown {
  const totals = optionTotals(items)
  const shares = energyShares(items)
  return {
    calorieFit: calorieFitScore(totals.calories ?? 0, ctx.budget.calories ?? 0),
    macroFit: macroFitScore(totals, ctx.budget, ctx.energyState),
    fiber: fiberScore(totals, ctx.budget, ctx.mealType),
    micronutrients: micronutrientScore(items, totals, ctx.budget, ctx.microGaps),
    preference: preferenceScore(items, shares, ctx),
    practicality: practicalityScore(items, ctx.prefs.maxPrepMinutes),
    variety: varietyScore(items, shares, ctx.variety),
  }
}

/**
 * Recommendation Ranking Engine: a multi-dimension score for one option against the meal budget.
 *
 * Weights on a regular day (`RANKING_WEIGHTS.normal`): calorie fit 0.20, macro fit 0.20, fiber 0.15,
 * micronutrients 0.15 (targeted gaps only; unknown values earn nothing and cost a small confidence penalty),
 * preference 0.10 (favorites, cuisines, diet emphasis), practicality 0.10 (prep time, no-cook, cost) and
 * variety 0.10 (eaten today, recent foods, repeated categories). With a light allowance fiber and
 * micronutrients rise to 0.20 each and macro fit (protein-led) drops to 0.10.
 *
 * No dimension weighs more than 0.20, so an option cannot rank first on a single nutrient.
 */
export function scoreOption(items: readonly ScoredItem[], ctx: RankingContext): ScoredOption {
  const sub = subScores(items, ctx)
  const w = RANKING_WEIGHTS[ctx.energyState]
  // Written out (no keyed loops): the planner scores a few hundred options per plan.
  const breakdown: ScoreBreakdown = {
    calorieFit: sub.calorieFit * w.calorieFit,
    macroFit: sub.macroFit * w.macroFit,
    fiber: sub.fiber * w.fiber,
    micronutrients: sub.micronutrients * w.micronutrients,
    preference: sub.preference * w.preference,
    practicality: sub.practicality * w.practicality,
    variety: sub.variety * w.variety,
  }
  const score =
    breakdown.calorieFit +
    breakdown.macroFit +
    breakdown.fiber +
    breakdown.micronutrients +
    breakdown.preference +
    breakdown.practicality +
    breakdown.variety
  return { score, breakdown }
}
