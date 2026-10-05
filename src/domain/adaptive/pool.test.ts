import { describe, expect, it } from 'vitest'
import { food, systemFood } from './__fixtures__/adaptive'
import { LUNCH_BUDGET, rankingContext } from './__fixtures__/ranking'
import { pickSides, rankAnchors, rankSides, sideAffinity } from './pool'
import { portionOption } from './portions'
import { scoreOption } from './ranking'

const chicken = systemFood('chicken_breast_roasted')
const tomato = systemFood('tomato')
const pepper = systemFood('red_bell_pepper')
const cucumber = systemFood('cucumber')
const oil = systemFood('olive_oil')

describe('rankAnchors', () => {
  it('scores anchor-capable foods alone, best first, ties by id', () => {
    const twinB = food({ id: 'b-twin', category: 'protein', per100g: { calories: 150, protein: 20, carbs: 5, fat: 5 } })
    const twinA = { ...twinB, id: 'a-twin' }
    const ctx = rankingContext()
    const scoreAlone = (item: typeof chicken) => scoreOption(portionOption([item], 700), ctx).score
    const ranked = rankAnchors([tomato, twinB, chicken, twinA], 'lunch', scoreAlone)
    expect(ranked.map((entry) => entry.food.id)).toEqual(expect.arrayContaining([chicken.id, 'a-twin', 'b-twin']))
    expect(ranked.map((entry) => entry.food.id)).not.toContain(tomato.id)
    const twins = ranked.filter((entry) => entry.food.id.endsWith('twin')).map((entry) => entry.food.id)
    expect(twins).toEqual(['a-twin', 'b-twin'])
    for (let i = 1; i < ranked.length; i += 1) expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score)
    for (const entry of ranked) expect(entry.score).toBe(scoreAlone(entry.food))
  })

  it('uses the meal slot to decide which foods can carry an option', () => {
    const bread = systemFood('white_bread')
    const constant = () => 1
    expect(rankAnchors([bread], 'breakfast', constant).map((entry) => entry.food.id)).toEqual([bread.id])
    expect(rankAnchors([bread], 'dinner', constant)).toEqual([])
  })
})

describe('sideAffinity', () => {
  it('prefers fiber- and micronutrient-dense sides over added fats', () => {
    const ctx = rankingContext()
    expect(sideAffinity(tomato, ctx)).toBeGreaterThan(sideAffinity(oil, ctx))
  })

  it('favours sides rich in the targeted micronutrient gaps', () => {
    const ctx = rankingContext({ gaps: ['vitaminC'], microGaps: ['vitaminC'] })
    expect(sideAffinity(pepper, ctx)).toBeGreaterThan(sideAffinity(cucumber, ctx))
    const unknownC = food({ category: 'vegetable', per100g: { calories: 26, vitaminC: null } })
    expect(sideAffinity(unknownC, ctx)).toBeLessThan(sideAffinity(pepper, ctx))
  })

  it('earns no micronutrient credit for a gap without a meal budget', () => {
    const withBudget = rankingContext({ gaps: ['vitaminC'], microGaps: ['vitaminC'] })
    const noBudget = rankingContext({ gaps: ['vitaminC'], microGaps: ['vitaminC'], budget: { ...LUNCH_BUDGET, vitaminC: 0 } })
    expect(sideAffinity(pepper, withBudget) - sideAffinity(pepper, noBudget)).toBeCloseTo(0.3)
    const { vitaminC: _unused, ...withoutVitaminC } = LUNCH_BUDGET
    expect(sideAffinity(pepper, rankingContext({ gaps: ['vitaminC'], microGaps: ['vitaminC'], budget: withoutVitaminC }))).toBe(
      sideAffinity(pepper, noBudget),
    )
    expect(sideAffinity(pepper, noBudget)).toBeLessThan(sideAffinity(pepper, rankingContext()))
  })

  it('judges a typical side portion, so watery vegetables earn less than their density suggests', () => {
    const ctx = rankingContext({ gaps: ['iron'], microGaps: ['iron'] })
    expect(sideAffinity(systemFood('spinach_raw'), ctx)).toBeGreaterThan(sideAffinity(systemFood('romaine_lettuce'), ctx))
  })

  it('favours protein-dense sides while protein is a gap', () => {
    const edamame = systemFood('edamame')
    const withGap = sideAffinity(edamame, rankingContext({ gaps: ['protein'] }))
    expect(withGap).toBeGreaterThan(sideAffinity(edamame, rankingContext()))
  })

  it('is 0 for foods without energy and for meals without an energy budget', () => {
    expect(sideAffinity(food({ category: 'vegetable', per100g: { calories: 0 } }), rankingContext())).toBe(0)
    expect(sideAffinity(food({ category: 'vegetable', per100g: { calories: null } }), rankingContext())).toBe(0)
    expect(sideAffinity(tomato, rankingContext({ budget: { ...LUNCH_BUDGET, calories: 0 } }))).toBe(0)
    const { calories: _unused, ...withoutEnergy } = LUNCH_BUDGET
    expect(sideAffinity(tomato, rankingContext({ budget: withoutEnergy }))).toBe(0)
  })

  it('measures snack sides against a smaller fiber goal', () => {
    const snack = rankingContext({ mealType: 'snack', budget: { calories: 200 } })
    const lunch = rankingContext({ budget: { calories: 200 } })
    expect(sideAffinity(systemFood('apple'), snack)).toBeGreaterThan(sideAffinity(systemFood('apple'), lunch))
  })
})

describe('rankSides and pickSides', () => {
  it('ranks side-capable foods for the meal', () => {
    const ranked = rankSides([chicken, systemFood('shakshuka'), tomato, systemFood('orange_juice')], rankingContext())
    expect(ranked.map((entry) => entry.food.id)).toEqual([tomato.id])
  })

  it('keeps the two best foods of each category that the style accepts', () => {
    const loose = [1, 2, 3].map(() => food({ category: null }))
    const ranked = [pepper, tomato, cucumber, oil, ...loose].map((item, i) => ({ food: item, score: 10 - i }))
    expect(pickSides(ranked, () => true)).toEqual([pepper, tomato, oil, ...loose.slice(0, 2)])
    expect(pickSides(ranked, (item) => item.id !== pepper.id)).toEqual([tomato, cucumber, oil, ...loose.slice(0, 2)])
  })
})
