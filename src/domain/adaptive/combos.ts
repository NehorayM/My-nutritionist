import type { FoodItem } from '@/types'
import type { RankingContext } from './context'
import { compareIds } from './order'
import { rankAnchors, type AnchorScore, type SideScore } from './pool'
import { portionOption } from './portions'
import { scoreOption } from './ranking'
import type { RecommendedItem, ScoreBreakdown } from './types'

/*
 * Per-plan cache of the meal builder: every food combination is portioned and scored once per energy target
 * (styles with the same target share it), plus anchor selection over foods scored alone.
 */

/** Foods of one option; the first is the anchor. */
export type Foods = readonly [FoodItem, ...FoodItem[]]

/** A portioned, scored combination. */
export interface Scored {
  items: RecommendedItem[]
  score: number
  breakdown: ScoreBreakdown
}

/** Scored combinations as a tree of food ids (anchor → side → side); no key strings in the hot path. */
interface ComboNode {
  scored: Scored | null
  next: Map<string, ComboNode>
}

function comboNode(): ComboNode {
  return { scored: null, next: new Map() }
}

/** Shared per plan: candidates, ranked sides and scored combinations. */
export interface Pools {
  candidates: readonly FoodItem[]
  sides: readonly SideScore[]
  /** Scored combinations by energy target. */
  scored: Map<number, ComboNode>
}

/** Empty pools for a plan's candidates and ranked sides. */
export function createPools(candidates: readonly FoodItem[], sides: readonly SideScore[]): Pools {
  return { candidates, sides, scored: new Map() }
}

/** The child of `node` for `id`, created when missing. */
function childOf(node: ComboNode, id: string): ComboNode {
  const existing = node.next.get(id)
  if (existing) return existing
  const created = comboNode()
  node.next.set(id, created)
  return created
}

/** The combination portioned for `kcal` and scored against the plan's context — computed once per plan. */
export function scoreCombination(pools: Pools, ctx: RankingContext, kcal: number, foods: Foods): Scored {
  let root = pools.scored.get(kcal)
  if (!root) {
    root = comboNode()
    pools.scored.set(kcal, root)
  }
  const node = foods.reduce((parent, food) => childOf(parent, food.id), root)
  if (!node.scored) {
    const items = portionOption(foods, kcal)
    node.scored = { items, ...scoreOption(items, ctx) }
  }
  return node.scored
}

/** The anchor-capable candidates that `accepts` allows, scored alone at `kcal`, best first (ties by id). */
export function rankedSingles(
  pools: Pools,
  ctx: RankingContext,
  accepts: (food: FoodItem) => boolean,
  kcal: number,
): AnchorScore[] {
  const accepted = pools.candidates.filter((food) => accepts(food))
  return rankAnchors(accepted, ctx.mealType, (food) => scoreCombination(pools, ctx, kcal, [food]).score)
}

interface Ranked {
  food: FoodItem
  rank: number
}

function byRank(a: Ranked, b: Ranked): number {
  return b.rank - a.rank || compareIds(a.food.id, b.food.id)
}

/**
 * The `count` best singles by `rank` (best first, ties by id). `rank` never exceeds the score alone (it only
 * subtracts penalties), so the scan stops once no later single can enter the selection.
 */
export function topAnchors(
  singles: readonly AnchorScore[],
  rank: (food: FoodItem, score: number) => number,
  count: number,
): FoodItem[] {
  const best: Ranked[] = []
  for (const { food, score } of singles) {
    const last = best[count - 1]
    if (last && score < last.rank) break
    best.push({ food, rank: rank(food, score) })
    best.sort(byRank)
    best.length = Math.min(best.length, count)
  }
  return best.map((entry) => entry.food)
}
