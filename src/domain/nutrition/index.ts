/** Nutrition engines — pure and deterministic; dates and times are always passed in. */
export * from './types'
export * from './constants'
export { DIET_DISTRIBUTIONS, PLANT_BASED_DIETS, type DietDistribution, type GramRange, type ShareTarget } from './diets'
export {
  AGE_BANDS,
  AGE_BAND_LABELS,
  DEFAULT_AGE_BAND,
  PLANT_BASED_IRON_FACTOR,
  REFERENCE_INTAKES,
  UPPER_LIMITS,
  ageBandFor,
  referenceIntake,
  upperLimit,
  type AgeBand,
} from './dri'
export { resolveTargetContext, type MissingField, type TargetContext } from './context'
export {
  dailyKcalForWeeklyRate,
  goalAdjustment,
  maintenanceFromBmr,
  mifflinStJeorBmr,
  type BodyMetrics,
  type GoalAdjustment,
  type GoalAdjustmentInput,
} from './energy'
export { MINOR_NOTE, estimateEnergy, type EnergyPlan } from './estimate'
export { macroTargets, proteinGramsPerKg, type MacroInput, type MacroTargets } from './macros'
export { micronutrientTargets, type MicronutrientTargets } from './micronutrients'
export { fiberTarget, limitTargets, type LimitTargets, type TargetWithNote } from './limits'
export { calculateDailyTargets } from './targets'
export { gramsForQuantity, isKnownAmount, portionNutrients, scaleNutrients } from './portion'
export { aggregateDay, sumNutrientProfiles, totalsForPortions, totalsToProfile } from './aggregation'
export { nutrientStatus } from './status'
export { remainingMealSlots } from './remainingMeals'
export { GAP_KEYS, calculateRemaining } from './remaining'
export { micronutrientCoverage } from './coverage'
