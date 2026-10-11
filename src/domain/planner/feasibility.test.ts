import { describe, expect, it } from 'vitest'
import { createDefaultProfile } from '../profile'
import { defaultPrepFor } from './defaults'
import { exclusionRules, mealBlock, mealMinutes, pantryExclusion, usesSoon } from './feasibility'
import { cooked, leftovers, pantry, TODAY, USER } from './__fixtures__/pantry'

const profile = (overrides: Partial<ReturnType<typeof createDefaultProfile>> = {}) => ({ ...createDefaultProfile(USER, '2026-10-01T00:00:00.000Z'), ...overrides })
const meal = { enabled: true, equipment: [], canCook: true, maxMinutes: 30, kcalMin: null, kcalMax: null }

describe('pantry items that are never planned', () => {
  it('skips expired, used-up and incomplete items', () => {
    const rules = exclusionRules(null, [], TODAY)
    expect(pantryExclusion(pantry('banana', { useBy: '2026-10-11' }), rules)).toBe('expired')
    expect(pantryExclusion(pantry('banana', { useBy: TODAY }), rules)).toBeNull()
    expect(pantryExclusion(pantry('banana', { grams: 5 }), rules)).toBe('used_up')
    const unknown = pantry('banana')
    expect(pantryExclusion({ ...unknown, food: { ...unknown.food, per100g: { ...unknown.food.per100g, calories: null } } }, rules)).toBe('incomplete_nutrition')
  })

  it('keeps occasional foods out unless they are favorites', () => {
    const chips = pantry('potato_chips')
    expect(pantryExclusion(chips, exclusionRules(null, [], TODAY))).toBe('occasional')
    expect(pantryExclusion(chips, exclusionRules(null, [chips.food.id], TODAY))).toBeNull()
  })

  it('respects allergies (unknown allergen data counts as a risk) and the diet', () => {
    const milkAllergy = exclusionRules(profile({ allergies: ['milk'] }), [], TODAY)
    expect(pantryExclusion(pantry('greek_yogurt_plain'), milkAllergy)).toBe('allergen')
    const unknown = pantry('banana')
    expect(pantryExclusion({ ...unknown, food: { ...unknown.food, allergens: null } }, milkAllergy)).toBe('allergen_unknown')
    const glutenAllergy = exclusionRules(profile({ allergies: ['gluten'] }), [], TODAY)
    expect(pantryExclusion(pantry('whole_wheat_bread'), glutenAllergy)).toBe('allergen')
    const vegan = exclusionRules(profile({ dietType: 'vegan' }), [], TODAY)
    expect(pantryExclusion(cooked('chicken_breast_roasted', 25), vegan)).toBe('diet')
    expect(pantryExclusion(pantry('tofu_firm'), vegan)).toBeNull()
  })
})

describe('what a meal allows', () => {
  it('ready-to-eat food always works', () => {
    expect(mealBlock(pantry('banana'), { ...meal, canCook: false, maxMinutes: 0 }, [])).toBeNull()
  })

  it('warming up needs matching equipment and a few minutes', () => {
    const rice = leftovers('white_rice_cooked')
    expect(mealBlock(rice, meal, ['microwave'])).toBeNull()
    expect(mealBlock(rice, meal, ['oven'])).toBe('no_equipment')
    expect(mealBlock(rice, { ...meal, maxMinutes: 2 }, ['microwave'])).toBe('not_enough_time')
    expect(mealBlock(rice, { ...meal, canCook: false }, ['microwave'])).toBeNull()
  })

  it('cooking from raw needs cooking allowed, equipment and time', () => {
    const chicken = cooked('chicken_breast_roasted', 25)
    expect(mealBlock(chicken, meal, ['stove'])).toBeNull()
    expect(mealBlock(chicken, { ...meal, canCook: false }, ['stove'])).toBe('no_cooking')
    expect(mealBlock(chicken, meal, ['microwave'])).toBe('no_equipment')
    expect(mealBlock(chicken, { ...meal, maxMinutes: 20 }, ['stove'])).toBe('not_enough_time')
  })

  it('times a meal by its longest cooking plus a little per extra cooked item', () => {
    expect(mealMinutes([pantry('banana')])).toBe(0)
    expect(mealMinutes([leftovers('white_rice_cooked'), pantry('tomato')])).toBe(3)
    expect(mealMinutes([cooked('chicken_breast_roasted', 25), cooked('lentils_cooked', 20), leftovers('white_rice_cooked')])).toBe(30)
  })

  it('knows which items should be used soon', () => {
    expect(usesSoon(pantry('banana', { useBy: '2026-10-14' }), TODAY, 2)).toBe(true)
    expect(usesSoon(pantry('banana', { useBy: '2026-10-15' }), TODAY, 2)).toBe(false)
    expect(usesSoon(pantry('banana'), TODAY, 2)).toBe(false)
  })
})

describe('defaults for new pantry items', () => {
  it('guesses how a food is eaten from the catalog and its name', () => {
    expect(defaultPrepFor(pantry('banana').food)).toEqual({ prep: 'ready', cookMinutes: null, methods: [] })
    expect(defaultPrepFor(pantry('chicken_breast_roasted').food)).toMatchObject({ prep: 'cook', cookMinutes: 25 })
    const usdaLeftover = { ...pantry('banana').food, requiresCooking: null, name: 'Rice, white, cooked', category: 'grain' as const }
    expect(defaultPrepFor(usdaLeftover)).toMatchObject({ prep: 'reheat', methods: ['microwave', 'stove'] })
    const rawLentils = { ...usdaLeftover, name: 'Lentils, raw', category: 'legume' as const }
    expect(defaultPrepFor(rawLentils)).toMatchObject({ prep: 'cook', methods: ['stove'] })
  })
})
