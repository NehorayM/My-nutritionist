import { MEAL_TYPES, type MealType, type PantryItem } from '@/types'
import { OPTIONS_PER_MEAL } from './constants'
import { composeDay } from './dayPlan'
import { exclusionRules, mealEquipment, pantryExclusion } from './feasibility'
import { buildMealOptions } from './mealOptions'
import { dailyRange, mealRanges } from './ranges'
import type { ExcludedItem, MealPlan, PlannerInput, PlannerResult } from './types'

/**
 * Meal planning from what is at home (pure and deterministic):
 * 1. pantry items that can't be planned at all are set aside with a reason (allergens, diet, expired…);
 * 2. each enabled meal gets options built only from the remaining items that its equipment, cooking possibility
 *    and time budget allow, sized to land in the meal's calorie range;
 * 3. one option per meal is combined into a day plan that never uses more of an item than is at home and lands
 *    in the daily calorie range when that is possible (`dayPlan.fits`).
 */
export function planMeals(input: PlannerInput): PlannerResult {
  const { settings, today } = input
  const variant = input.variant ?? 0
  const rules = exclusionRules(input.profile, input.favoriteFoodIds ?? [], today)
  const usable: PantryItem[] = []
  const excluded: ExcludedItem[] = []
  for (const item of input.pantry) {
    const reason = pantryExclusion(item, rules)
    if (reason === null) usable.push(item)
    else excluded.push({ pantryItemId: item.id, foodName: item.food.name, reason })
  }

  const day = dailyRange(settings, input.calories)
  const enabled: MealType[] = MEAL_TYPES.filter((meal) => settings.meals[meal].enabled)
  const ranges = mealRanges(settings, enabled, day)
  const built = MEAL_TYPES.map((meal) => {
    const range = ranges[meal] ?? { min: 0, max: 0, target: 0 }
    const result = buildMealOptions({
      meal,
      constraint: settings.meals[meal],
      equipment: mealEquipment(settings, meal),
      items: usable,
      range,
      today,
      variant,
    })
    return { mealType: meal, range, ...result }
  })

  const dayPlan = composeDay(
    built.filter((meal) => meal.gap !== 'disabled'),
    usable,
    day,
  )
  const meals: MealPlan[] = built.map(({ mealType, range, options, gap }) => ({
    mealType,
    range,
    options: options.slice(0, OPTIONS_PER_MEAL),
    gap,
  }))
  return { day, meals, dayPlan, excluded }
}
