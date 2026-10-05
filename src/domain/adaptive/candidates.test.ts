import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import type { Profile } from '@/types'
import { food, profile, systemFood } from './__fixtures__/adaptive'
import { effectivePrepMinutes, emptyExclusions, filterCandidates } from './candidates'
import { EXCLUSION_REASONS } from './types'

function filter(foods: Parameters<typeof filterCandidates>[0], overrides: Partial<Profile> = {}, mealType: Parameters<typeof filterCandidates>[1]['mealType'] = 'lunch') {
  return filterCandidates(foods, { profile: profile(overrides), mealType })
}

describe('filterCandidates', () => {
  it('keeps complete, unrestricted foods in input order and reports every reason with 0', () => {
    const foods = [food(), food(), food()]
    const result = filter(foods)
    expect(result.candidates).toEqual(foods)
    expect(Object.keys(result.excluded).sort()).toEqual([...EXCLUSION_REASONS].sort())
    expect(Object.values(result.excluded).every((count) => count === 0)).toBe(true)
  })

  it('excludes foods missing calories, protein, carbohydrate or fat, and foods without energy', () => {
    const result = filter([
      food({ per100g: { calories: null } }),
      food({ per100g: { protein: null } }),
      food({ per100g: { carbs: Number.NaN } }),
      food({ per100g: { fat: -1 } }),
      food({ per100g: { calories: 0 } }),
      food({ per100g: { fiber: null, iron: null } }),
    ])
    expect(result.candidates).toHaveLength(1)
    expect(result.excluded.incomplete_nutrition).toBe(4)
    expect(result.excluded.no_energy).toBe(1)
  })

  it('excludes any allergen overlap and unknown allergen data when the user has allergies', () => {
    const peanut = food({ allergens: ['peanuts'] })
    const unknown = food({ allergens: null })
    const safe = food({ allergens: ['milk'] })
    const result = filter([peanut, unknown, safe], { allergies: ['peanuts'] })
    expect(result.candidates).toEqual([safe])
    expect(result.excluded.allergen).toBe(1)
    expect(result.excluded.allergen_unknown).toBe(1)
  })

  it('keeps foods with unknown allergen data when the user has no allergies', () => {
    const unknown = food({ allergens: null })
    expect(filter([unknown]).candidates).toEqual([unknown])
  })

  it('a gluten allergy also excludes wheat', () => {
    const wheatOnly = food({ allergens: ['wheat'] })
    const glutenOnly = food({ allergens: ['gluten'] })
    expect(filter([wheatOnly, glutenOnly], { allergies: ['gluten'] }).candidates).toEqual([])
    expect(filter([wheatOnly, glutenOnly], { allergies: ['wheat'] }).candidates).toEqual([glutenOnly])
  })

  it('applies the diet pattern as a hard filter for vegetarian and vegan', () => {
    const meat = food({ dietFlags: { vegetarian: false, vegan: false } })
    const dairy = food({ dietFlags: { vegetarian: true, vegan: false } })
    const plant = food({ dietFlags: { vegetarian: true, vegan: true } })
    expect(filter([meat, dairy, plant], { dietType: 'vegetarian' }).candidates).toEqual([dairy, plant])
    const vegan = filter([meat, dairy, plant], { dietType: 'vegan' })
    expect(vegan.candidates).toEqual([plant])
    expect(vegan.excluded.diet).toBe(2)
  })

  it('excludes dislikes by whole word on name, category and tags', () => {
    const olives = food({ name: 'Green olives' })
    const fish = food({ name: 'Baked cod', category: 'protein', tags: ['fish'] })
    const fastFood = food({ name: 'Burger', category: 'fast_food' })
    const eggplant = food({ name: 'Eggplant salad' })
    const homemade = food({ name: 'Olive tapenade', category: null })
    const result = filter([olives, fish, fastFood, eggplant, homemade], { dislikes: ['Olive', 'FISH', 'fast food', 'egg'] })
    expect(result.candidates).toEqual([eggplant])
    expect(result.excluded.dislike).toBe(4)
  })

  it('keeps foods for the meal slot, foods listing no slot, and everything when no slot is given', () => {
    const breakfastOnly = food({ mealTypes: ['breakfast'] })
    const anyMeal = food({ mealTypes: [] })
    const lunch = filter([breakfastOnly, anyMeal])
    expect(lunch.candidates).toEqual([anyMeal])
    expect(lunch.excluded.meal_type).toBe(1)
    expect(filter([breakfastOnly, anyMeal], {}, null).candidates).toHaveLength(2)
  })

  it('respects the preferred prep time; unknown prep passes only for foods that need no cooking', () => {
    const slow = food({ prepMinutes: 50 })
    const atLimit = food({ prepMinutes: 45 })
    const unknownNoCook = food({ prepMinutes: null, requiresCooking: false })
    const unknownCooked = food({ prepMinutes: null, requiresCooking: true })
    const unknownUnknown = food({ prepMinutes: null, requiresCooking: null })
    const result = filter([slow, atLimit, unknownNoCook, unknownCooked, unknownUnknown], { maxPrepMinutes: 45 })
    expect(result.candidates).toEqual([atLimit, unknownNoCook])
    expect(result.excluded.prep_time).toBe(3)
  })

  it('beginner cooks see foods with at most 20 minutes of preparation', () => {
    const quick = food({ prepMinutes: 20 })
    const involved = food({ prepMinutes: 25 })
    const beginner = filter([quick, involved], { cookingSkill: 'beginner', maxPrepMinutes: 60 })
    expect(beginner.candidates).toEqual([quick])
    expect(beginner.excluded.cooking_skill).toBe(1)
    expect(filter([quick, involved], { cookingSkill: 'confident', maxPrepMinutes: 60 }).candidates).toHaveLength(2)
  })

  it('counts each excluded food once, under the first rule it fails', () => {
    const many = food({ allergens: ['peanuts'], dietFlags: { vegetarian: false, vegan: false }, prepMinutes: 90 })
    const result = filter([many], { allergies: ['peanuts'], dietType: 'vegan' })
    expect(result.excluded).toEqual({ ...emptyExclusions(), allergen: 1 })
  })

  it('ignores duplicate ids', () => {
    const one = food()
    expect(filter([one, one]).candidates).toEqual([one])
  })

  it('uses app defaults (30-minute prep) without a profile', () => {
    const result = filterCandidates([food({ prepMinutes: 30 }), food({ prepMinutes: 31 })], { profile: null, mealType: 'dinner' })
    expect(result.candidates).toHaveLength(1)
  })

  it('combines a restrictive diet with an allergy on the system catalog', () => {
    const result = filter(SYSTEM_FOODS, { dietType: 'vegan', allergies: ['soy', 'sesame'] }, 'dinner')
    for (const item of result.candidates) {
      expect(item.dietFlags.vegan).toBe(true)
      expect(item.allergens).not.toBeNull()
      expect(item.allergens).not.toContain('soy')
      expect(item.allergens).not.toContain('sesame')
    }
    const names = result.candidates.map((item) => item.externalId)
    expect(names).toContain('lentils_cooked')
    expect(names).not.toContain('tofu_firm')
    expect(names).not.toContain('hummus')
    expect(names).not.toContain(systemFood('chicken_breast_roasted').externalId)
  })
})

describe('effectivePrepMinutes', () => {
  it('uses stated minutes (never negative), 0 for unknown no-cook foods, otherwise unknown', () => {
    expect(effectivePrepMinutes({ prepMinutes: 12, requiresCooking: true })).toBe(12)
    expect(effectivePrepMinutes({ prepMinutes: -3, requiresCooking: true })).toBe(0)
    expect(effectivePrepMinutes({ prepMinutes: Number.POSITIVE_INFINITY, requiresCooking: false })).toBe(0)
    expect(effectivePrepMinutes({ prepMinutes: null, requiresCooking: false })).toBe(0)
    expect(effectivePrepMinutes({ prepMinutes: null, requiresCooking: null })).toBeNull()
  })
})
