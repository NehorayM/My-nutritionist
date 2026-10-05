import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import type { FoodItem } from '@/types'
import { food, profile } from './__fixtures__/adaptive'
import { LUNCH_BUDGET, prefs, rankingContext } from './__fixtures__/ranking'
import { effectivePrepMinutes, filterCandidates } from './candidates'
import { buildMealOptions, type BuildOptionsInput, type OptionDraft } from './builder'
import { netCarbsPer100g } from './diets'
import { portionRange } from './portionRanges'

const lunchFoods = filterCandidates(SYSTEM_FOODS, { profile: profile(), mealType: 'lunch' }).candidates

function build(overrides: Partial<BuildOptionsInput> = {}) {
  return buildMealOptions({ candidates: lunchFoods, ctx: rankingContext(), dismissedIds: new Set(), variant: 0, ...overrides })
}

function kcal(option: OptionDraft): number {
  return option.items.reduce((sum, item) => sum + (item.nutrients.calories ?? 0), 0)
}

function byStyle(options: OptionDraft[], style: OptionDraft['style']): OptionDraft {
  const found = options.find((option) => option.style === style)
  if (!found) throw new Error(`No ${style} option`)
  return found
}

describe('buildMealOptions', () => {
  const { options, dismissedAny } = build()

  it('builds one option per style with deterministic ids and 1–3 components', () => {
    expect(new Set(options.map((option) => option.style)).size).toBe(options.length)
    expect(options.length).toBeGreaterThanOrEqual(6)
    expect(dismissedAny).toBe(false)
    for (const option of options) {
      const ids = option.items.map((item) => item.food.id).sort()
      expect(option.key).toBe(ids.join('+'))
      expect(option.id).toBe(`${option.style}:lunch:${option.key}`)
      expect(option.items.length).toBeGreaterThanOrEqual(1)
      expect(option.items.length).toBeLessThanOrEqual(3)
    }
  })

  it('never repeats an item set across styles', () => {
    expect(new Set(options.map((option) => option.key)).size).toBe(options.length)
  })

  it('sizes regular options to the meal budget (±15 %) and light options below it', () => {
    const budget = LUNCH_BUDGET.calories!
    expect(Math.abs(kcal(byStyle(options, 'balanced')) - budget)).toBeLessThanOrEqual(0.15 * budget)
    expect(kcal(byStyle(options, 'light'))).toBeLessThanOrEqual(0.7 * budget * 1.15)
  })

  it('uses realistic portions: whole household units or 5 g steps', () => {
    const items = options.flatMap((option) => option.items)
    const inGrams = items.filter((item) => item.servingGrams === null)
    const inUnits = items.filter((item) => item.servingGrams !== null)
    expect(inGrams.length + inUnits.length).toBeGreaterThan(0)
    expect(inGrams.every((item) => item.grams % 5 === 0 && item.quantity === item.grams && item.servingLabel === null)).toBe(true)
    expect(
      inUnits.every(
        (item) => Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 4 && item.servingLabel !== null,
      ),
    ).toBe(true)
  })

  it('follows each style’s rules', () => {
    const foodsOf = (style: OptionDraft['style']): FoodItem[] => byStyle(options, style).items.map((item) => item.food)
    expect(foodsOf('quick').every((item) => (effectivePrepMinutes(item) ?? 99) <= 10)).toBe(true)
    expect(foodsOf('no_cook').every((item) => item.requiresCooking === false)).toBe(true)
    expect(foodsOf('budget').every((item) => item.costTier === 1)).toBe(true)
    expect(foodsOf('mediterranean')[0]?.tags).toContain('mediterranean')
    expect(foodsOf('light').length).toBeLessThanOrEqual(2)
  })

  it('builds styles relevant to today’s gaps first', () => {
    const built = build({ ctx: rankingContext({ gaps: ['protein'] }) })
    expect(built.options[0]?.style).toBe('high_protein')
  })

  it('skips styles the candidates cannot satisfy', () => {
    const cooked = lunchFoods.filter((item) => item.requiresCooking === true && item.costTier !== 1)
    const styles = build({ candidates: cooked }).options.map((option) => option.style)
    expect(styles).not.toContain('no_cook')
    expect(styles).not.toContain('budget')
  })

  it('replaces a dismissed option with another alternative and reports the dismissal', () => {
    const balanced = byStyle(options, 'balanced')
    const after = build({ dismissedIds: new Set([balanced.id]) })
    expect(after.dismissedAny).toBe(true)
    expect(after.options.map((option) => option.id)).not.toContain(balanced.id)
    expect(after.options.some((option) => option.style === 'balanced')).toBe(true)
  })

  it('rotates alternatives deterministically with the variant', () => {
    const ids = (variant: number) => build({ variant }).options.map((option) => option.id)
    expect(ids(1)).toEqual(ids(1))
    expect(ids(1)).not.toEqual(ids(0))
    expect(ids(-1)).toEqual(ids(-1))
    expect(ids(0.7)).toEqual(ids(0))
    expect(ids(Number.NaN)).toEqual(ids(0))
    const balancedIds = new Set([0, 1, 2].map((variant) => byStyle(build({ variant }).options, 'balanced').id))
    expect(balancedIds.size).toBe(3)
  })

  it('fills the list to three options with alternatives when only one style can be satisfied', () => {
    const dishes = ['a', 'b', 'c'].map((suffix) =>
      food({
        id: `dish-${suffix}`,
        category: 'protein',
        per100g: { calories: 250, protein: 12, carbs: 20, fat: 13 },
        prepMinutes: 20,
        requiresCooking: true,
        costTier: 2,
      }),
    )
    const built = build({ candidates: dishes })
    expect(built.options.map((option) => option.style)).toEqual(['balanced', 'balanced', 'balanced'])
    expect(new Set(built.options.map((option) => option.id)).size).toBe(3)
  })

  it('never fills the list with an item set already shown by another style', () => {
    const dishes = ['a', 'b'].map((suffix) =>
      food({
        id: `quick-dish-${suffix}`,
        category: 'protein',
        per100g: { calories: 250, protein: 12, carbs: 20, fat: 13 },
        prepMinutes: 5,
        requiresCooking: true,
        costTier: 2,
      }),
    )
    const built = build({ candidates: dishes })
    expect(built.options.map((option) => option.style)).toEqual(['balanced', 'quick'])
    expect(new Set(built.options.map((option) => option.key)).size).toBe(2)
  })

  it('uses the smallest realistic portions when the meal has no energy budget', () => {
    const built = build({ ctx: rankingContext({ budget: { fiber: 10 } }) })
    const items = built.options.flatMap((option) => option.items)
    expect(items.length).toBeGreaterThan(0)
    for (const part of items) expect(part.grams).toBeLessThanOrEqual(Math.max(5, portionRange(part.food).min * 1.15))
  })

  it('returns nothing when no food can carry an option', () => {
    const sidesOnly = lunchFoods.filter((item) => item.category === 'vegetable')
    expect(build({ candidates: sidesOnly }).options).toEqual([])
    expect(build({ candidates: [] }).options).toEqual([])
  })

  it('composes keto options from lower-carbohydrate foods', () => {
    const keto = build({ ctx: rankingContext({ prefs: prefs({ dietType: 'keto' }) }) })
    const foods = keto.options.flatMap((option) => option.items.map((item) => item.food))
    expect(foods.length).toBeGreaterThan(0)
    expect(foods.every((item) => (netCarbsPer100g(item) ?? 99) <= 10)).toBe(true)
  })
})
