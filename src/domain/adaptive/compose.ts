import type { FoodItem } from '@/types'
import { ALTERNATIVES_PER_STYLE, ANCHORS_PER_STYLE, FOLLOW_UP_SIDES } from './constants'
import { rankedSingles, scoreCombination, topAnchors, type Foods, type Pools, type Scored } from './combos'
import type { RankingContext } from './context'
import { ID_SEPARATOR, dishName, dishSignature, optionId } from './dishes'
import { compareIds } from './order'
import { pickSides } from './pool'
import { STYLE_RULES, fitsWith, maxSidesFor } from './styles'
import type { RecommendationStyle, RecommendedItem, ScoreBreakdown } from './types'

/** A composed option before presentation (title, explanation, highlights). */
export interface OptionDraft {
  /** Deterministic id: `style:mealType:foodIds` (food ids sorted, joined by "+"). */
  id: string
  /** Sorted food ids — identical keys mean identical item sets. */
  key: string
  /** Sorted dish names (see `dishSignature`) — options with equal signatures read the same and are shown once. */
  signature: string
  /** Dish name of the food that carries the option (the first item). */
  anchorDish: string
  style: RecommendationStyle
  items: RecommendedItem[]
  score: number
  breakdown: ScoreBreakdown
  /** Relevance of the style today (see `STYLE_RULES`). */
  relevance: number
}

/** A side is kept only when it lifts the option's score by at least this much. */
const MIN_SIDE_GAIN = 0.005
/**
 * Dishes already shown in another style's option rank lower (per earlier appearance) while composing, so the
 * list shows different foods; the reported score is never changed by this.
 */
const REUSE_PENALTY = 0.04
/** A dish that already carries another option ranks this much lower as an anchor (one pizza option, not two). */
const ANCHOR_REPEAT_PENALTY = 0.1

/** Best score first; ties by id so the order is deterministic. */
export function byScore(a: Pick<OptionDraft, 'score' | 'id'>, b: Pick<OptionDraft, 'score' | 'id'>): number {
  return b.score - a.score || compareIds(a.id, b.id)
}

export interface Composer {
  style: RecommendationStyle
  relevance: number
  ctx: RankingContext
  /** Appearances of each dish (by `dishName`) in options already chosen. */
  used: ReadonlyMap<string, number>
  /** Dishes that carry options already chosen. */
  anchored: ReadonlySet<string>
}

/** Selection penalty for dishes already shown (the first food is the anchor). */
function reuse(c: Composer, foods: Foods): number {
  const repeats = foods.reduce((sum, food) => sum + (c.used.get(dishName(food)) ?? 0), 0)
  return REUSE_PENALTY * repeats + (c.anchored.has(dishName(foods[0])) ? ANCHOR_REPEAT_PENALTY : 0)
}

interface Candidate {
  option: OptionDraft
  /** Score minus the reuse penalty — used only to choose between options. */
  rank: number
}

/** A scored food combination while composing (the option itself is built only for the winner). */
interface Evaluated {
  foods: Foods
  scored: Scored
  rank: number
}

function energyTarget(c: Composer): number {
  return (c.ctx.budget.calories ?? 0) * STYLE_RULES[c.style].energyFactor(c.ctx.energyState)
}

/** The combination's cached score; the rank subtracts this style's reuse penalty. */
function evaluate(c: Composer, pools: Pools, foods: Foods): Evaluated {
  const scored = scoreCombination(pools, c.ctx, energyTarget(c), foods)
  return { foods, scored, rank: scored.score - reuse(c, foods) }
}

function toCandidate(c: Composer, { foods, scored, rank }: Evaluated): Candidate {
  const ids = foods.map((food) => food.id)
  const option: OptionDraft = {
    id: optionId(c.style, c.ctx.mealType, ids),
    key: ids.sort(compareIds).join(ID_SEPARATOR),
    signature: dishSignature(foods),
    anchorDish: dishName(foods[0]),
    style: c.style,
    items: scored.items,
    score: scored.score,
    breakdown: scored.breakdown,
    relevance: c.relevance,
  }
  return { option, rank }
}

/**
 * Anchor alone, then greedily add the side that lifts the (reuse-adjusted) score most, up to the style's limit.
 * After the first side, only the runners-up of the previous round are tried (a narrow beam keeps planning fast).
 */
function compose(c: Composer, pools: Pools, anchor: FoodItem, sides: readonly FoodItem[]): Candidate {
  const { mealType } = c.ctx
  let pool = sides.filter((side) => fitsWith(side, [anchor], mealType))
  let best = evaluate(c, pools, [anchor])
  for (let round = 0; round < maxSidesFor(c.style, mealType); round += 1) {
    const chosen = best.foods.slice(1)
    const tried = pool
      .filter((side) => fitsWith(side, chosen, mealType))
      .map((side) => ({ side, option: evaluate(c, pools, [...best.foods, side]) }))
      .sort((a, b) => b.option.rank - a.option.rank)
    const next = tried[0]
    if (!next || next.option.rank < best.rank + MIN_SIDE_GAIN) break
    best = next.option
    pool = tried.slice(1, 1 + FOLLOW_UP_SIDES).map((entry) => entry.side)
  }
  return toCandidate(c, best)
}

/** The style's best anchors: candidates the style accepts, by their score alone minus the reuse penalty. */
function anchorsFor(c: Composer, pools: Pools): FoodItem[] {
  const singles = rankedSingles(pools, c.ctx, STYLE_RULES[c.style].anchor, energyTarget(c))
  return topAnchors(singles, (food, score) => score - reuse(c, [food]), ANCHORS_PER_STYLE)
}

/**
 * Up to three options for a style that read differently (distinct signatures), best first (by score minus the
 * reuse penalty); empty when the style cannot be satisfied. Each of the style's best anchors is completed with
 * the sides the style accepts.
 */
export function alternativesFor(c: Composer, pools: Pools): OptionDraft[] {
  const sides = pickSides(pools.sides, STYLE_RULES[c.style].side)
  const bySignature = new Map<string, Candidate>()
  for (const anchor of anchorsFor(c, pools)) {
    const candidate = compose(c, pools, anchor, sides)
    const existing = bySignature.get(candidate.option.signature)
    if (!existing || candidate.rank > existing.rank) bySignature.set(candidate.option.signature, candidate)
  }
  return [...bySignature.values()]
    .sort((a, b) => b.rank - a.rank || compareIds(a.option.id, b.option.id))
    .slice(0, ALTERNATIVES_PER_STYLE)
    .map((candidate) => candidate.option)
}
