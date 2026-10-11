/** Meal planning from the pantry (Kitchen tab): pure, deterministic, no I/O. */
export * from './types'
export { MEAL_SHARES, OPTIONS_PER_MEAL, REHEAT_MINUTES, USE_SOON_DAYS } from './constants'
export { createDefaultPlannerSettings, defaultPrepFor, type PrepDefaults } from './defaults'
export {
  equipmentFor,
  itemMinutes,
  mealBlock,
  mealEquipment,
  mealMinutes,
  pantryExclusion,
  usesSoon,
  type MealBlock,
  type PantryExclusion,
} from './feasibility'
export { dailyRange, mealRanges, type CalorieTarget, type KcalRange } from './ranges'
export { plateRole, type PlateRole } from './roles'
export { availableRange, sizePortions } from './portions'
export { planMeals } from './engine'
