import { describe, expect, it } from 'vitest'
import { food } from './__fixtures__/adaptive'
import { item, noVariety, prefs, rankingContext } from './__fixtures__/ranking'
import { energyShares, matchesCuisine, optionPrepMinutes, practicalityScore, preferenceScore, varietyScore } from './behaviorFit'

describe('matchesCuisine', () => {
  it('matches cuisine tags, and Israeli dishes as Middle Eastern', () => {
    expect(matchesCuisine(food({ tags: ['italian'] }), ['italian'])).toBe(true)
    expect(matchesCuisine(food({ tags: ['israeli'] }), ['middle_eastern'])).toBe(true)
    expect(matchesCuisine(food({ category: 'israeli', tags: [] }), ['middle_eastern', 'asian'])).toBe(true)
    expect(matchesCuisine(food({ tags: ['mexican'] }), ['italian'])).toBe(false)
    expect(matchesCuisine(food({ tags: ['italian'] }), [])).toBe(false)
  })
})

describe('energyShares', () => {
  it('splits by known energy, equally when nothing has energy', () => {
    const a = food({ per100g: { calories: 100 } })
    const b = food({ per100g: { calories: 300 } })
    const none = food({ per100g: { calories: null } })
    expect(energyShares([item(a, 100), item(b, 100)])).toEqual([0.25, 0.75])
    expect(energyShares([item(none, 100), item(none, 50)])).toEqual([0.5, 0.5])
  })
})

describe('preferenceScore', () => {
  const plain = food({ tags: [] })
  const italian = food({ tags: ['italian'] })

  it('adds favorites (35 %), preferred cuisines (25 %) and diet emphasis (40 %)', () => {
    const ctx = rankingContext({ prefs: prefs({ preferredCuisines: ['italian'] }), favorites: new Set([plain.id]) })
    expect(preferenceScore([item(food(), 100)], [1], ctx)).toBeCloseTo(0.2)
    expect(preferenceScore([item(plain, 100)], [1], ctx)).toBeCloseTo(0.55)
    expect(preferenceScore([item(italian, 100)], [1], ctx)).toBeCloseTo(0.45)
  })

  it('weights each component by its share of the option energy', () => {
    const ctx = rankingContext({ favorites: new Set([plain.id]) })
    expect(preferenceScore([item(plain, 100), item(food(), 100)], [0.25, 0.75], ctx)).toBeCloseTo(0.35 * 0.25 + 0.2)
  })

  it('counts components without an energy share as nothing', () => {
    const ctx = rankingContext({ favorites: new Set([plain.id]) })
    expect(preferenceScore([item(food(), 100), item(plain, 100)], [1], ctx)).toBeCloseTo(0.2)
  })

  it('follows the diet emphasis', () => {
    const ctx = rankingContext({ prefs: prefs({ dietType: 'mediterranean' }) })
    const tagged = food({ tags: ['mediterranean'] })
    expect(preferenceScore([item(tagged, 100)], [1], ctx)).toBeGreaterThan(preferenceScore([item(plain, 100)], [1], ctx))
  })
})

describe('practicality', () => {
  it('takes the longest component as the option prep time (unknown counts as 0)', () => {
    const items = [item(food({ prepMinutes: 5 }), 100), item(food({ prepMinutes: 25 }), 100), item(food({ prepMinutes: null, requiresCooking: null }), 50)]
    expect(optionPrepMinutes(items)).toBe(25)
    expect(optionPrepMinutes([])).toBe(0)
  })

  it('prefers quick, no-cook, budget-friendly options', () => {
    const easy = food({ prepMinutes: 5, requiresCooking: false, costTier: 1 })
    const involved = food({ prepMinutes: 45, requiresCooking: true, costTier: 3 })
    expect(practicalityScore([item(easy, 100)], 45)).toBe(1)
    expect(practicalityScore([item(involved, 100)], 45)).toBeCloseTo(0.5 * 0.3 + 0.25 * 0.2)
    expect(practicalityScore([item(easy, 100), item(involved, 100)], 45)).toBeCloseTo(0.5 * 0.3 + 0.25 * 0.5 + 0.25 * 0.6)
  })

  it('scales prep time between 10 minutes and the user’s limit, never below 0.3', () => {
    const at = (minutes: number, limit: number) =>
      practicalityScore([item(food({ prepMinutes: minutes, requiresCooking: true, costTier: null }), 100)], limit)
    expect(at(10, 30)).toBeCloseTo(0.5 + 0.25 * 0.5)
    expect(at(20, 30)).toBeCloseTo(0.5 * 0.65 + 0.25 * 0.5)
    expect(at(90, 30)).toBeCloseTo(0.5 * 0.3 + 0.25 * 0.5)
    expect(at(12, 5)).toBeCloseTo(0.5 * 0.3 + 0.25 * 0.5)
  })

  it('is 0 for an empty option', () => {
    expect(practicalityScore([], 30)).toBe(0)
  })
})

describe('varietyScore', () => {
  const rice = food({ name: 'Brown rice', category: 'grain' })
  const pasta = food({ name: 'Pasta', category: 'grain' })
  const tomato = food({ name: 'Tomato', category: 'vegetable' })

  it('is 1 for foods not eaten today or recently', () => {
    expect(varietyScore([item(rice, 100)], [1], noVariety())).toBe(1)
  })

  it('penalizes foods already eaten today, by id or by name', () => {
    expect(varietyScore([item(rice, 100)], [1], noVariety({ eatenIds: new Set([rice.id]) }))).toBeCloseTo(0.4)
    expect(varietyScore([item(rice, 100)], [1], noVariety({ eatenNames: new Set(['brown rice']) }))).toBeCloseTo(0.4)
  })

  it('penalizes recent foods, the latest most', () => {
    const latest = varietyScore([item(rice, 100)], [1], noVariety({ recentRank: new Map([[rice.id, 0]]) }))
    const older = varietyScore([item(rice, 100)], [1], noVariety({ recentRank: new Map([[rice.id, 9]]) }))
    expect(latest).toBeCloseTo(0.7)
    expect(older).toBeCloseTo(1 - 0.3 * (1 - 9 / 20))
  })

  it('penalizes repeating a category eaten today, except vegetables and fruit', () => {
    const variety = noVariety({ categoryCounts: new Map([['grain', 1], ['vegetable', 2]]) })
    expect(varietyScore([item(pasta, 100)], [1], variety)).toBeCloseTo(0.85)
    expect(varietyScore([item(tomato, 100)], [1], variety)).toBe(1)
  })

  it('ignores components without an energy share', () => {
    expect(varietyScore([item(tomato, 100), item(rice, 100)], [1], noVariety({ eatenIds: new Set([rice.id]) }))).toBe(1)
  })

  it('weights penalties by energy share and never goes below 0', () => {
    const heavy = noVariety({ eatenIds: new Set([rice.id]), recentRank: new Map([[rice.id, 0]]), categoryCounts: new Map([['grain', 1]]) })
    expect(varietyScore([item(rice, 100), item(tomato, 100)], [0.5, 0.5], heavy)).toBeCloseTo(1 - 0.5 * 1.05)
    expect(varietyScore([item(rice, 100)], [1], heavy)).toBe(0)
  })
})
