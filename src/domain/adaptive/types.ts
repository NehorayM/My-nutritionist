import type { FoodItem, MealEntry, MealType, NutrientKey, NutrientProfile, Profile } from '@/types'
import type { DailyTargets } from '../nutrition/types'

export const RECOMMENDATION_STYLES = [
  'balanced',
  'high_protein',
  'quick',
  'no_cook',
  'mediterranean',
  'budget',
  'light',
] as const
export type RecommendationStyle = (typeof RECOMMENDATION_STYLES)[number]

/** Nutrient amounts the next meal should aim for (subset of nutrients). */
export type MealBudget = Partial<Record<NutrientKey, number>>

export interface AdaptiveInput {
  profile: Profile | null
  targets: DailyTargets
  /** All entries logged for the day being planned. */
  entries: MealEntry[]
  /** Current local time; determines remaining meals and meal timing. */
  now: Date
  /** Local date (YYYY-MM-DD) being planned. Past dates produce no recommendations. */
  date: string
  /** Pool of candidate foods (system catalog + user foods). */
  foods: FoodItem[]
  favoriteFoodIds: string[]
  /** Foods eaten recently (most recent first) — used for variety. */
  recentFoodIds: string[]
  /** Recommendation ids the user dismissed today. */
  dismissedIds: string[]
  /** Rotates through equally-ranked alternatives deterministically ("View alternative"). */
  variant?: number
}

export interface RecommendedItem {
  food: FoodItem
  grams: number
  /** Serving label used for display (e.g. "1 cup"), or null for grams. */
  servingLabel: string | null
  servingGrams: number | null
  quantity: number
  nutrients: NutrientProfile
}

export interface ScoreBreakdown {
  calorieFit: number
  macroFit: number
  fiber: number
  micronutrients: number
  preference: number
  practicality: number
  variety: number
}

export interface MealRecommendation {
  /** Deterministic id (style + meal + food ids), stable across recomputation. */
  id: string
  style: RecommendationStyle
  /** Short display title, e.g. "Mediterranean chicken plate". */
  title: string
  mealType: MealType
  items: RecommendedItem[]
  totals: NutrientProfile
  prepMinutes: number
  score: number
  breakdown: ScoreBreakdown
  /** One-sentence neutral explanation of why this option fits. */
  explanation: string
  /** Nutrients this option meaningfully contributes to (for badges). */
  highlights: NutrientKey[]
}

export type AdaptiveStatus = 'ok' | 'day_complete' | 'no_candidates' | 'past_day'

export interface AdaptivePlan {
  status: AdaptiveStatus
  /** Meal slot the recommendations target; null when no meal remains. */
  targetMeal: MealType | null
  budget: MealBudget
  recommendations: MealRecommendation[]
  /** Neutral, supportive summary sentence for the section header. */
  message: string
}
