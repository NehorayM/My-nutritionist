import { compareDateKeys, isDateKey, toDateKey } from '../dates'
import { aggregateDay, calculateRemaining } from '../nutrition'
import { isMinor } from '../profile'
import { allocateMeal, nextMealSlot } from './allocation'
import { optionPrepMinutes } from './behaviorFit'
import { buildMealOptions, byScore, type OptionDraft } from './builder'
import { filterCandidates } from './candidates'
import { MAX_RECOMMENDATIONS, STYLE_RELEVANCE_BONUS } from './constants'
import { microGapsOf, varietySignals, type RankingContext } from './context'
import { explainOption, optionHighlights, optionTitle } from './explanations'
import { planMessage, type PlanMessageInput } from './messages'
import { fitsEnergyBudget } from './nutritionFit'
import { resolvePreferences } from './preferences'
import { optionTotals } from './ranking'
import type { AdaptiveInput, AdaptivePlan, MealBudget, MealRecommendation } from './types'

function plan(message: PlanMessageInput, budget: MealBudget, recommendations: MealRecommendation[] = []): AdaptivePlan {
  return { status: message.status, targetMeal: message.targetMeal, budget, recommendations, message: planMessage(message) }
}

function present(option: OptionDraft, input: AdaptiveInput, ctx: RankingContext): MealRecommendation {
  const totals = optionTotals(option.items)
  const highlights = optionHighlights(totals, input.targets.targets, ctx.gaps)
  const fitsBudget = fitsEnergyBudget(totals.calories, ctx.budget.calories)
  return {
    id: option.id,
    style: option.style,
    title: optionTitle(option.items.map((item) => item.food)),
    mealType: ctx.mealType,
    items: option.items,
    totals,
    prepMinutes: optionPrepMinutes(option.items),
    score: option.score,
    breakdown: option.breakdown,
    explanation: explainOption({ style: option.style, highlights, energyState: ctx.energyState, fitsBudget }),
    highlights,
  }
}

/** The most relevant, best-scoring options (at most six), ordered by score. */
function finalize(options: readonly OptionDraft[]): OptionDraft[] {
  const priority = (option: OptionDraft): number => option.score + STYLE_RELEVANCE_BONUS * option.relevance
  return [...options]
    .sort((a, b) => priority(b) - priority(a) || byScore(a, b))
    .slice(0, MAX_RECOMMENDATIONS)
    .sort(byScore)
}

/**
 * Adaptive Nutrition Engine: suggestions for the next meal of `date`, recomputed from the day's real entries.
 *
 * - past_day: `date` is before today → no suggestions.
 * - day_complete: no meal slot remains today.
 * - no_candidates: allergies, diet, dislikes, meal slot or prep time leave no usable food (or no food exists).
 * - ok: up to six options (three or more when the food pool allows), one per style, sorted by score. Ids are
 *   deterministic (`style:meal:foodIds`), dismissed ids never return (when every option was dismissed the list
 *   is empty and the message says so), and `variant` rotates each style's alternatives deterministically.
 *
 * Under-18s always get regular-sized meals (no light allowance). Pure: time comes from `now`.
 * @throws RangeError when `date` is not a valid YYYY-MM-DD key.
 */
export function buildAdaptivePlan(input: AdaptiveInput): AdaptivePlan {
  if (!isDateKey(input.date)) throw new RangeError(`Invalid plan date: ${input.date}`)
  const base = { energyState: 'normal', gaps: [], foodsAvailable: input.foods.length > 0, allDismissed: false } as const
  if (compareDateKeys(input.date, toDateKey(input.now)) < 0) return plan({ ...base, status: 'past_day', targetMeal: null }, {})

  const { totals } = aggregateDay(input.date, input.entries)
  const remaining = calculateRemaining({ targets: input.targets, totals, entries: input.entries, now: input.now, date: input.date })
  const targetMeal = nextMealSlot(remaining.remainingMeals)
  if (targetMeal === null) return plan({ ...base, status: 'day_complete', targetMeal: null }, {})

  const regularMeals = input.profile !== null && isMinor(input.profile, input.date)
  const { budget, energyState } = allocateMeal(remaining, input.targets, targetMeal, remaining.remainingMeals, { regularMeals })
  const ctx: RankingContext = {
    budget,
    energyState,
    mealType: targetMeal,
    gaps: remaining.gaps,
    microGaps: microGapsOf(remaining.gaps, budget),
    prefs: resolvePreferences(input.profile),
    favorites: new Set(input.favoriteFoodIds),
    variety: varietySignals(input.entries, input.date, input.foods, input.recentFoodIds),
  }
  const { candidates } = filterCandidates(input.foods, { profile: input.profile, mealType: targetMeal })
  const built = buildMealOptions({ candidates, ctx, dismissedIds: new Set(input.dismissedIds), variant: input.variant ?? 0 })
  const empty = built.options.length === 0
  const message: PlanMessageInput = { ...base, status: 'ok', targetMeal, energyState, gaps: remaining.gaps, allDismissed: empty && built.dismissedAny }
  if (empty && !built.dismissedAny) return plan({ ...message, status: 'no_candidates' }, budget)
  return plan(message, budget, finalize(built.options).map((option) => present(option, input, ctx)))
}
