import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import type { FoodItem } from '@/types'
import { food, profile } from './__fixtures__/adaptive'
import { rankingContext } from './__fixtures__/ranking'
import { filterCandidates } from './candidates'
import { createPools, rankedSingles, scoreCombination, topAnchors } from './combos'
import { memoize } from './memo'
import { compareIds } from './order'
import { canAnchor } from './pairing'
import { portionOption } from './portions'
import { scoreOption } from './ranking'

const ctx = rankingContext()
const candidates = filterCandidates(SYSTEM_FOODS, { profile: profile(), mealType: 'lunch' }).candidates

describe('scoreCombination', () => {
  it('portions and scores a combination once per energy target', () => {
    const pools = createPools(candidates, [])
    const [a, b] = candidates as [FoodItem, FoodItem]
    const first = scoreCombination(pools, ctx, 700, [a, b])
    expect(scoreCombination(pools, ctx, 700, [a, b])).toBe(first)
    const items = portionOption([a, b], 700)
    expect(first).toEqual({ items, ...scoreOption(items, ctx) })
    const lighter = scoreCombination(pools, ctx, 490, [a, b])
    expect(lighter).not.toBe(first)
    expect(lighter.items).toEqual(portionOption([a, b], 490))
  })
})

describe('rankedSingles', () => {
  it('ranks the accepted anchor-capable foods alone, best first', () => {
    const pools = createPools(candidates, [])
    const cheap = (item: FoodItem) => item.costTier === 1
    const ranked = rankedSingles(pools, ctx, cheap, 700)
    expect(ranked.length).toBeGreaterThan(3)
    for (const { food: item, score } of ranked) {
      expect(cheap(item) && canAnchor(item, 'lunch')).toBe(true)
      expect(score).toBe(scoreCombination(pools, ctx, 700, [item]).score)
    }
    const scores = ranked.map((entry) => entry.score)
    expect(scores).toEqual([...scores].sort((x, y) => y - x))
  })
})

describe('topAnchors', () => {
  const singles = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ food: food({ id }), score: 0.9 - 0.05 * Math.floor(i / 2) }))
  const penalties: Record<string, number> = { a: 0.2, c: 0.04, e: 0 }
  const rank = (item: FoodItem, score: number) => score - (penalties[item.id] ?? 0)

  function bruteForce(count: number): string[] {
    return singles
      .map(({ food: item, score }) => ({ id: item.id, rank: rank(item, score) }))
      .sort((x, y) => y.rank - x.rank || compareIds(x.id, y.id))
      .slice(0, count)
      .map((entry) => entry.id)
  }

  it('picks the best by rank (penalties applied, ties by id), as a full sort would', () => {
    for (const count of [1, 2, 3, 4, 6, 9]) {
      expect(topAnchors(singles, rank, count).map((item) => item.id)).toEqual(bruteForce(count))
    }
  })

  it('stops scanning once no later food can enter the selection', () => {
    const ranked: string[] = []
    const unpenalized = (item: FoodItem, score: number): number => {
      ranked.push(item.id)
      return score
    }
    expect(topAnchors(singles, unpenalized, 2).map((item) => item.id)).toEqual(['a', 'b'])
    expect(ranked).toEqual(['a', 'b'])
  })

  it('returns nothing for an empty list or a zero count', () => {
    expect(topAnchors([], rank, 3)).toEqual([])
    expect(topAnchors(singles, rank, 0)).toEqual([])
  })
})

describe('memoize', () => {
  it('computes once per object, including null results', () => {
    const calls: string[] = []
    const lookup = memoize((key: { name: string }) => {
      calls.push(key.name)
      return key.name === 'none' ? null : key.name.length
    })
    const one = { name: 'one' }
    const none = { name: 'none' }
    expect([lookup(one), lookup(one), lookup(none), lookup(none), lookup({ name: 'one' })]).toEqual([3, 3, null, null, 3])
    expect(calls).toEqual(['one', 'none', 'one'])
  })
})
