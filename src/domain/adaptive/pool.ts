import type { FoodCategory, FoodItem, MealType } from '@/types'
import { scaleNutrients } from '../nutrition'
import { practicalityScore, preferenceScore, varietyScore } from './behaviorFit'
import { MIN_MEAL_FIBER_G, NEUTRAL_SUBSCORE } from './constants'
import type { RankingContext } from './context'
import { proteinEnergyShare } from './diets'
import { dishName } from './dishes'
import { clamp01 } from './nutritionFit'
import { byScoreThenFoodId } from './order'
import { sideGrams } from './portions'
import { canAnchor, canSide } from './pairing'

export interface AnchorScore {
  food: FoodItem
  /** Score of the food alone (as given by the caller). */
  score: number
}

/** A side earns full fiber or micronutrient credit when a typical portion supplies half of the meal's goal. */
const FULL_SIDE_GOAL_SHARE = 0.5
/** Protein density earning full side credit while protein is a gap: 40 % of energy. */
const FULL_PROTEIN_ENERGY_SHARE = 0.4
const SIDE_AFFINITY_MIX = { fiber: 0.3, micro: 0.3, protein: 0.1, preference: 0.1, practicality: 0.1, variety: 0.1 } as const
/** Side pool: the best foods of each category (keeps grains, fats and dairy in reach, not only vegetables). */
const SIDES_PER_CATEGORY = 2
const UNCATEGORIZED = 'uncategorized'

/** Anchor-capable candidates for the meal with their score alone, best first (ties by id for determinism). */
export function rankAnchors(
  candidates: readonly FoodItem[],
  mealType: MealType,
  scoreAlone: (food: FoodItem) => number,
): AnchorScore[] {
  return candidates
    .filter((food) => canAnchor(food, mealType))
    .map((food) => ({ food, score: scoreAlone(food) }))
    .sort(byScoreThenFoodId)
}

/** Share of the meal goal a portion supplies, scaled so half the goal earns full credit (unknown → 0). */
function goalCredit(amount: number | null, goal: number): number {
  if (amount === null || goal <= 0) return 0
  return clamp01(amount / (goal * FULL_SIDE_GOAL_SHARE))
}

/**
 * How well a food complements an anchor, judged on a typical side portion (`sideGrams`): its fiber against the
 * meal's fiber goal (30 %), its targeted micronutrient gaps (30 %; neutral without gaps), protein density while
 * protein is a gap (10 %), and the food's preference, practicality and variety (10 % each).
 */
export function sideAffinity(food: FoodItem, ctx: RankingContext): number {
  const mealKcal = ctx.budget.calories ?? 0
  if ((food.per100g.calories ?? 0) <= 0 || mealKcal <= 0) return 0
  const nutrients = scaleNutrients(food.per100g, sideGrams(food, mealKcal))
  const fiberGoal = Math.max(ctx.budget.fiber ?? 0, MIN_MEAL_FIBER_G[ctx.mealType === 'snack' ? 'snack' : 'main'])
  const micro =
    ctx.microGaps.length === 0
      ? NEUTRAL_SUBSCORE
      : ctx.microGaps.reduce((sum, key) => sum + goalCredit(nutrients[key], ctx.budget[key] ?? 0), 0) / ctx.microGaps.length
  const protein = ctx.gaps.includes('protein') ? clamp01(proteinEnergyShare(food) / FULL_PROTEIN_ENERGY_SHARE) : NEUTRAL_SUBSCORE
  const single = [{ food, grams: 100, nutrients: food.per100g }]
  return (
    SIDE_AFFINITY_MIX.fiber * goalCredit(nutrients.fiber, fiberGoal) +
    SIDE_AFFINITY_MIX.micro * micro +
    SIDE_AFFINITY_MIX.protein * protein +
    SIDE_AFFINITY_MIX.preference * preferenceScore(single, [1], ctx) +
    SIDE_AFFINITY_MIX.practicality * practicalityScore(single, ctx.prefs.maxPrepMinutes) +
    SIDE_AFFINITY_MIX.variety * varietyScore(single, [1], ctx.variety)
  )
}

export interface SideScore {
  food: FoodItem
  /** `sideAffinity` of the food. */
  score: number
}

/** Side-capable candidates by affinity, best first (ties by id). */
export function rankSides(candidates: readonly FoodItem[], ctx: RankingContext): SideScore[] {
  return candidates
    .filter((food) => canSide(food, ctx.mealType))
    .map((food) => ({ food, score: sideAffinity(food, ctx) }))
    .sort(byScoreThenFoodId)
}

/** The side pool for one style: ranked sides it accepts, at most two per category and one per dish, best first. */
export function pickSides(ranked: readonly SideScore[], accept: (food: FoodItem) => boolean): FoodItem[] {
  const perCategory = new Map<FoodCategory | typeof UNCATEGORIZED, number>()
  const dishes = new Set<string>()
  const sides: FoodItem[] = []
  for (const { food } of ranked) {
    if (!accept(food) || dishes.has(dishName(food))) continue
    const category = food.category ?? UNCATEGORIZED
    const count = perCategory.get(category) ?? 0
    if (count >= SIDES_PER_CATEGORY) continue
    perCategory.set(category, count + 1)
    dishes.add(dishName(food))
    sides.push(food)
  }
  return sides
}
