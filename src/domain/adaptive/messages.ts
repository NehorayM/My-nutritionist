import type { MealType, NutrientKey } from '@/types'
import { joinList, nutrientPhrase } from './explanations'
import type { AdaptiveStatus, EnergyState } from './types'

/** Meal names as they read mid-sentence. */
const MEAL_PHRASES: Readonly<Record<MealType, string>> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'a snack',
}

/** At most two gaps are named in the header message. */
const MAX_GAPS_IN_MESSAGE = 2

export interface PlanMessageInput {
  status: AdaptiveStatus
  targetMeal: MealType | null
  energyState: EnergyState
  gaps: readonly NutrientKey[]
  /** False when there were no foods at all to choose from (rather than none matching preferences). */
  foodsAvailable: boolean
  /** True when every remaining option was dismissed. */
  allDismissed: boolean
}

function okMessage(meal: string, energyState: EnergyState, gaps: readonly NutrientKey[], allDismissed: boolean): string {
  if (allDismissed) return `You've set aside today's options for ${meal} — new ones will appear as your day changes.`
  if (energyState === 'surplus') {
    return "Today's intake is already above your energy target — lighter, fiber-rich options can round out the day."
  }
  if (energyState === 'light') return "You're close to your energy target — lighter options can round out the day."
  const named = gaps.slice(0, MAX_GAPS_IN_MESSAGE).map(nutrientPhrase)
  if (named.length > 0) return `Options for ${meal} that add ${joinList(named)} to your day.`
  return `Options for ${meal} that fit what's left of today.`
}

/** Neutral, supportive header sentence for the "Smart options for the rest of today" section. */
export function planMessage({ status, targetMeal, energyState, gaps, foodsAvailable, allDismissed }: PlanMessageInput): string {
  const meal = targetMeal ? MEAL_PHRASES[targetMeal] : 'this meal'
  switch (status) {
    case 'past_day':
      return 'Suggestions are for today and the days ahead.'
    case 'day_complete':
      return 'No more meals are planned for today — fresh suggestions will be ready tomorrow.'
    case 'no_candidates':
      return foodsAvailable
        ? `No foods match your current preferences for ${meal} — reviewing allergies, dislikes, diet or prep time in your profile can open up more options.`
        : 'No foods are available for suggestions yet — searching for or adding foods will open up options.'
    case 'ok':
      return okMessage(meal, energyState, gaps, allDismissed)
  }
}
