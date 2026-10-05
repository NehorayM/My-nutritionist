import { describe, expect, it } from 'vitest'
import { DIET_TYPES } from '@/types'
import { food, systemFood } from './__fixtures__/adaptive'
import { DIET_RULES, KETO_NET_CARBS_G, dietRule, netCarbsPer100g, optionPool, proteinEnergyShare } from './diets'

describe('diet rules', () => {
  it('defines a rule for every diet type', () => {
    for (const diet of DIET_TYPES) expect(dietRule(diet)).toBe(DIET_RULES[diet])
  })

  it('vegetarian and vegan need the flag to be explicitly true (unknown is incompatible)', () => {
    const vegan = food({ dietFlags: { vegetarian: true, vegan: true } })
    const vegetarianOnly = food({ dietFlags: { vegetarian: true, vegan: false } })
    const unknown = food({ dietFlags: { vegetarian: null, vegan: null } })
    const meat = food({ dietFlags: { vegetarian: false, vegan: false } })

    expect([vegan, vegetarianOnly, unknown, meat].map(dietRule('vegetarian').isCompatible)).toEqual([true, true, false, false])
    expect([vegan, vegetarianOnly, unknown, meat].map(dietRule('vegan').isCompatible)).toEqual([true, false, false, false])
  })

  it('balanced, keto, mediterranean and high-protein never remove foods', () => {
    const anything = food({ dietFlags: { vegetarian: null, vegan: null }, per100g: { carbs: 80, fiber: 1 } })
    for (const diet of ['balanced', 'keto', 'mediterranean', 'high_protein'] as const) {
      expect(dietRule(diet).isCompatible(anything)).toBe(true)
    }
  })

  it('balanced, vegetarian and vegan give every food the neutral emphasis', () => {
    const anything = food()
    for (const diet of ['balanced', 'vegetarian', 'vegan'] as const) expect(dietRule(diet).emphasis(anything)).toBe(0.5)
  })

  it('keto prefers foods with at most 10 g net carbohydrate per 100 g', () => {
    const emphasis = dietRule('keto').emphasis
    expect(emphasis(food({ per100g: { carbs: 12, fiber: 4 } }))).toBe(1)
    expect(emphasis(food({ per100g: { carbs: 17.5, fiber: 0 } }))).toBeCloseTo(0.5)
    expect(emphasis(food({ per100g: { carbs: 50, fiber: 3 } }))).toBe(0)
    expect(emphasis(food({ per100g: { carbs: null } }))).toBe(0)
  })

  it('keto options use foods up to 10 g net carbohydrate per 100 g', () => {
    const suits = dietRule('keto').suitsOptions
    expect(suits(food({ per100g: { carbs: KETO_NET_CARBS_G.preferred + 2, fiber: 2 } }))).toBe(true)
    expect(suits(food({ per100g: { carbs: KETO_NET_CARBS_G.preferred + 1, fiber: 0 } }))).toBe(false)
    expect(suits(systemFood('lentils_cooked'))).toBe(false)
    expect(suits(food({ per100g: { carbs: null } }))).toBe(false)
  })

  it('mediterranean boosts foods tagged mediterranean', () => {
    const emphasis = dietRule('mediterranean').emphasis
    expect(emphasis(food({ tags: ['mediterranean'] }))).toBe(1)
    expect(emphasis(food({ tags: ['budget'] }))).toBe(0.25)
  })

  it('high-protein boosts protein density (10 % → 40 % of energy)', () => {
    const emphasis = dietRule('high_protein').emphasis
    expect(emphasis(food({ per100g: { calories: 100, protein: 2 } }))).toBe(0)
    expect(emphasis(food({ per100g: { calories: 100, protein: 6.25 } }))).toBeCloseTo(0.5)
    expect(emphasis(food({ per100g: { calories: 100, protein: 20 } }))).toBe(1)
  })
})

describe('nutrient helpers', () => {
  it('net carbohydrate subtracts known fiber and never goes below zero', () => {
    expect(netCarbsPer100g(food({ per100g: { carbs: 20, fiber: 8 } }))).toBe(12)
    expect(netCarbsPer100g(food({ per100g: { carbs: 20, fiber: null } }))).toBe(20)
    expect(netCarbsPer100g(food({ per100g: { carbs: 2, fiber: 5 } }))).toBe(0)
    expect(netCarbsPer100g(food({ per100g: { carbs: null } }))).toBeNull()
  })

  it('protein energy share is 0 when energy or protein is unknown or zero, and capped at 1', () => {
    expect(proteinEnergyShare(food({ per100g: { calories: 200, protein: 10 } }))).toBeCloseTo(0.2)
    expect(proteinEnergyShare(food({ per100g: { calories: null, protein: 10 } }))).toBe(0)
    expect(proteinEnergyShare(food({ per100g: { calories: 100, protein: null } }))).toBe(0)
    expect(proteinEnergyShare(food({ per100g: { calories: 0, protein: 1 } }))).toBe(0)
    expect(proteinEnergyShare(food({ per100g: { calories: 40, protein: 12 } }))).toBe(1)
  })
})

describe('optionPool', () => {
  it('keeps every food for diets without option preferences', () => {
    const foods = [food({ per100g: { carbs: 60 } }), food()]
    expect(optionPool(foods, 'balanced')).toEqual(foods)
  })

  it('narrows keto options to lower-carbohydrate foods', () => {
    const bread = food({ per100g: { carbs: 50, fiber: 2 } })
    const eggs = food({ per100g: { carbs: 1, fiber: 0 } })
    expect(optionPool([bread, eggs], 'keto')).toEqual([eggs])
  })

  it('falls back to every food when none suits keto options', () => {
    const foods = [food({ per100g: { carbs: 50, fiber: 2 } }), food({ per100g: { carbs: 70, fiber: 3 } })]
    expect(optionPool(foods, 'keto')).toEqual(foods)
  })
})
