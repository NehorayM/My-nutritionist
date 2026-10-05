import type { FoodCategory, MealType } from '@/types'
import type { EnergyState, ScoreBreakdown } from './types'

/*
 * Constants of the Adaptive Nutrition Engine. They are app conventions (not clinical rules) chosen for
 * practical, balanced suggestions; the rationale sits next to each value.
 */

// ── Allocation ───────────────────────────────────────────────────────────────────────────────

/** Relative size of each meal slot when splitting what remains of the day: main meals 1, snacks 0.35. */
export const MEAL_WEIGHTS: Readonly<Record<MealType, number>> = { breakfast: 1, lunch: 1, dinner: 1, snack: 0.35 }

/** A light meal is about half a regular meal (regular = the slot's share of the daily energy target). */
export const LIGHT_MEAL_FACTOR = 0.5

/** One meal never aims above 1.6 × a regular meal, however much energy remains (no oversized catch-up meals). */
export const MAX_MEAL_FACTOR = 1.6

/**
 * Goal and limit nutrients keep at least half of the meal's proportional share of the daily target, so a meal
 * stays balanced even after a day that already covered (or went past) that nutrient.
 */
export const BUDGET_FLOOR_SHARE = 0.5

/** …and at most twice that share, so one meal or snack is never asked to make up the whole day. */
export const BUDGET_CAP_SHARE = 2

/** Protein never takes more than half of a meal's energy budget. */
export const PROTEIN_MAX_ENERGY_SHARE = 0.5

/** Carbohydrate's part of the non-protein energy when the carbohydrate and fat budgets cannot set it. */
export const DEFAULT_CARB_SHARE_OF_REST = 0.55

/** Population reference energy when targets carry no calorie target (FDA Daily Value reference). */
export const FALLBACK_DAILY_KCAL = 2000

// ── Ranking ──────────────────────────────────────────────────────────────────────────────────

/**
 * Weight of each ranking dimension; each dimension's sub-score is 0–1, so the score is 0–1 (the micronutrient
 * dimension may dip slightly below 0 through the confidence penalty). No single nutrient can dominate: the
 * largest weight is 0.2. With little energy left, fiber and micronutrients gain weight and macro fit leans on protein.
 */
export const RANKING_WEIGHTS: Readonly<Record<EnergyState, ScoreBreakdown>> = {
  normal: { calorieFit: 0.2, macroFit: 0.2, fiber: 0.15, micronutrients: 0.15, preference: 0.1, practicality: 0.1, variety: 0.1 },
  light: { calorieFit: 0.2, macroFit: 0.1, fiber: 0.2, micronutrients: 0.2, preference: 0.1, practicality: 0.1, variety: 0.1 },
  surplus: { calorieFit: 0.2, macroFit: 0.1, fiber: 0.2, micronutrients: 0.2, preference: 0.1, practicality: 0.1, variety: 0.1 },
}

/** Calorie fit: full credit within ±10 %; zero at +50 % (over) or −60 % (under). */
export const CALORIE_FIT = { tolerance: 0.1, overZero: 0.5, underZero: 0.6 } as const

/**
 * Macro fit per macro: relative deviation from its budget — full credit within ±15 %, zero at ±75 %; extra
 * protein counts half. Budgets below 10 % of the meal's energy are measured against that 10 % (small budgets
 * such as keto carbohydrate stay strict without becoming all-or-nothing).
 */
export const MACRO_FIT = { tolerance: 0.15, zeroAt: 0.75, floorEnergyShare: 0.1, extraProteinFactor: 0.5 } as const

/** With a light allowance, protein aims for at least 30 % of the meal's energy (satisfying, lighter meals). */
export const LIGHT_PROTEIN_ENERGY_SHARE = 0.3

/** Share of macro fit per macro (normal day / light allowance). */
export const MACRO_SHARES: Readonly<Record<'normal' | 'light', { protein: number; carbs: number; fat: number }>> = {
  normal: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  light: { protein: 0.6, carbs: 0.2, fat: 0.2 },
}

/** Sodium or saturated fat at double the meal allowance removes up to 25 % of macro fit. */
export const LIMIT_PENALTY = 0.25

/** Fiber credit is measured against the meal's fiber budget, but never against less than this (g). */
export const MIN_MEAL_FIBER_G: Readonly<Record<'main' | 'snack', number>> = { main: 4, snack: 2 }

/** Sub-score used for a dimension that has nothing to judge (no micronutrient gaps, balanced diet emphasis). */
export const NEUTRAL_SUBSCORE = 0.5

/** Each targeted micronutrient value that is unknown costs this share of the micronutrient sub-score. */
export const UNKNOWN_MICRO_PENALTY = 0.25

/** Preference sub-score mix: favorites, preferred cuisines, diet emphasis (energy-weighted per item). */
export const PREFERENCE_MIX = { favorite: 0.35, cuisine: 0.25, diet: 0.4 } as const

/** Practicality mix: preparation time, no-cook share, cost tier. */
export const PRACTICALITY_MIX = { prep: 0.5, noCook: 0.25, cost: 0.25 } as const

/** Prep up to 10 min scores 1, falling to 0.3 at the user's maximum. */
export const QUICK_PREP_MINUTES = 10
export const SLOW_PREP_SCORE = 0.3

export const COST_SCORES: Readonly<Record<1 | 2 | 3, number>> = { 1: 1, 2: 0.6, 3: 0.2 }
export const UNKNOWN_COST_SCORE = 0.5

/** Variety penalties (energy-weighted per item): already eaten today, eaten recently, same category as today's meals. */
export const VARIETY_PENALTY = { eatenToday: 0.6, recentMax: 0.3, category: 0.15 } as const

/** Recently eaten foods count for this many positions of `recentFoodIds`; the penalty halves across the window. */
export const RECENT_WINDOW = 10

/** Categories whose repetition through the day is welcome (never penalised for variety). */
export const REPEATABLE_CATEGORIES: readonly FoodCategory[] = ['vegetable', 'fruit']

/** A nutrient is highlighted when one option supplies at least 20 % of the daily target (FDA "high in" ≈ 20 % DV). */
export const HIGHLIGHT_DAILY_SHARE = 0.2
export const MAX_HIGHLIGHTS = 3

/** Composition of an option within ±15 % of the energy budget "fits" it. */
export const PORTION_TOLERANCE = 0.15

// ── Plan ─────────────────────────────────────────────────────────────────────────────────────

export const MIN_RECOMMENDATIONS = 3
export const MAX_RECOMMENDATIONS = 6
/** Alternatives built per style; "View alternative" rotates through them. */
export const ALTERNATIVES_PER_STYLE = 3
/**
 * Anchors tried per style, and the best runners-up of the first side considered as the second side (keeps
 * planning well under 30 ms).
 */
export const ANCHORS_PER_STYLE = 4
export const FOLLOW_UP_SIDES = 5
/** Bonus per relevance point when choosing which styles make the final list (order stays by score). */
export const STYLE_RELEVANCE_BONUS = 0.02
/** Beginner cooks see foods with at most this much preparation. */
export const BEGINNER_MAX_PREP_MINUTES = 20
