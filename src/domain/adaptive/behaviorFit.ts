import type { Cuisine, FoodItem } from '@/types'
import { effectivePrepMinutes } from './candidates'
import {
  COST_SCORES,
  PRACTICALITY_MIX,
  PREFERENCE_MIX,
  QUICK_PREP_MINUTES,
  RECENT_WINDOW,
  REPEATABLE_CATEGORIES,
  SLOW_PREP_SCORE,
  UNKNOWN_COST_SCORE,
  VARIETY_PENALTY,
} from './constants'
import { foodNameKey, type RankingContext, type VarietySignals } from './context'
import { dietRule } from './diets'
import { clamp01, type ScoredItem } from './nutritionFit'

/*
 * Behavior dimensions of the Recommendation Ranking Engine (0–1 sub-scores): preference, practicality, variety.
 * Per-item signals are weighted by each component's share of the option's energy.
 */

/** Food tags that count as each cuisine; Israeli dishes also count as Middle Eastern. */
const CUISINE_TAGS: Readonly<Partial<Record<Cuisine, readonly string[]>>> = {
  middle_eastern: ['middle_eastern', 'israeli'],
}

export function matchesCuisine(food: FoodItem, cuisines: readonly Cuisine[]): boolean {
  return cuisines.some((cuisine) => {
    const tags = CUISINE_TAGS[cuisine] ?? [cuisine]
    return tags.some((tag) => food.tags.includes(tag) || food.category === tag)
  })
}

/** Each component's share of the option's energy (equal shares when the option has no known energy). */
export function energyShares(items: readonly ScoredItem[]): number[] {
  const kcal = items.map((item) => item.nutrients.calories ?? 0)
  const total = kcal.reduce((sum, value) => sum + value, 0)
  return kcal.map((value) => (total > 0 ? value / total : 1 / items.length))
}

/** Favorites (35 %), preferred cuisines (25 %) and the diet pattern's emphasis (40 %). */
export function preferenceScore(items: readonly ScoredItem[], shares: readonly number[], ctx: Pick<RankingContext, 'prefs' | 'favorites'>): number {
  const rule = dietRule(ctx.prefs.dietType)
  let favorite = 0
  let cuisine = 0
  let diet = 0
  items.forEach((item, i) => {
    const share = shares[i] ?? 0
    if (ctx.favorites.has(item.food.id)) favorite += share
    if (matchesCuisine(item.food, ctx.prefs.preferredCuisines)) cuisine += share
    diet += share * rule.emphasis(item.food)
  })
  return PREFERENCE_MIX.favorite * favorite + PREFERENCE_MIX.cuisine * cuisine + PREFERENCE_MIX.diet * diet
}

/** Preparation time of an option: components are prepared side by side, so the longest one sets it. */
export function optionPrepMinutes(items: readonly Pick<ScoredItem, 'food'>[]): number {
  return items.reduce((longest, item) => Math.max(longest, effectivePrepMinutes(item.food) ?? 0), 0)
}

function prepScore(minutes: number, maxPrepMinutes: number): number {
  if (minutes <= QUICK_PREP_MINUTES) return 1
  const span = Math.max(1, maxPrepMinutes - QUICK_PREP_MINUTES)
  return Math.max(SLOW_PREP_SCORE, 1 - ((1 - SLOW_PREP_SCORE) * (minutes - QUICK_PREP_MINUTES)) / span)
}

/** Preparation time (50 %), share of no-cook components (25 %) and cost tier (25 %). */
export function practicalityScore(items: readonly ScoredItem[], maxPrepMinutes: number): number {
  if (items.length === 0) return 0
  const noCook = items.filter((item) => item.food.requiresCooking === false).length / items.length
  const cost =
    items.reduce((sum, item) => sum + (item.food.costTier === null ? UNKNOWN_COST_SCORE : COST_SCORES[item.food.costTier]), 0) /
    items.length
  return (
    PRACTICALITY_MIX.prep * prepScore(optionPrepMinutes(items), maxPrepMinutes) +
    PRACTICALITY_MIX.noCook * noCook +
    PRACTICALITY_MIX.cost * cost
  )
}

function itemPenalty(food: FoodItem, variety: VarietySignals): number {
  let penalty = 0
  if (variety.eatenIds.has(food.id) || variety.eatenNames.has(foodNameKey(food))) penalty += VARIETY_PENALTY.eatenToday
  const rank = variety.recentRank.get(food.id)
  if (rank !== undefined) penalty += VARIETY_PENALTY.recentMax * (1 - rank / (2 * RECENT_WINDOW))
  const category = food.category
  if (category && !REPEATABLE_CATEGORIES.includes(category) && (variety.categoryCounts.get(category) ?? 0) > 0) {
    penalty += VARIETY_PENALTY.category
  }
  return penalty
}

/**
 * 1 minus the energy-weighted penalties: eaten today (0.6), eaten recently (0.3 for the latest food, easing to
 * 0.15 at the end of the recent window), same category as something eaten today (0.15; vegetables and fruit
 * are always welcome again).
 */
export function varietyScore(items: readonly ScoredItem[], shares: readonly number[], variety: VarietySignals): number {
  const penalty = items.reduce((sum, item, i) => sum + (shares[i] ?? 0) * itemPenalty(item.food, variety), 0)
  return clamp01(1 - penalty)
}
