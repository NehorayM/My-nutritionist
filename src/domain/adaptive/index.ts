/** Adaptive Nutrition Engine — pure and deterministic; time is always passed in. */
export * from './types'
export {
  ALTERNATIVES_PER_STYLE,
  LIGHT_MEAL_FACTOR,
  MAX_MEAL_FACTOR,
  MAX_RECOMMENDATIONS,
  MEAL_WEIGHTS,
  MIN_RECOMMENDATIONS,
  RANKING_WEIGHTS,
} from './constants'
export { DIET_RULES, dietRule, netCarbsPer100g, proteinEnergyShare, type DietRule } from './diets'
export { containsPhrase, resolvePreferences, type AdaptivePreferences } from './preferences'
export { effectivePrepMinutes, filterCandidates, type CandidateOptions } from './candidates'
export {
  allocateMeal,
  allocateMealBudget,
  dailyEnergyTarget,
  mealWeight,
  nextMealSlot,
  type AllocationOptions,
} from './allocation'
export { microGapsOf, varietySignals, type RankingContext, type VarietySignals } from './context'
export { optionTotals, scoreOption, subScores, type ScoredOption } from './ranking'
export { PORTION_GRAMS, SIDE_ENERGY_SHARE, portionRange, sideShare, type GramRange } from './portionRanges'
export { portionOption, roundPortion, sideGrams } from './portions'
export { ID_SEPARATOR, dishName, dishSignature, dismissedSignatures, optionId } from './dishes'
export { STYLE_RULES, stylesByRelevance, type StyleRule, type StyleSignals } from './styles'
export { buildMealOptions, type BuildOptionsInput, type BuiltOptions, type OptionDraft } from './builder'
export { explainOption, optionHighlights, optionTitle, shortName, type ExplanationInput } from './explanations'
export { planMessage, type PlanMessageInput } from './messages'
export { buildAdaptivePlan } from './engine'
