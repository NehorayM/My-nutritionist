import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import { DIET_TYPES, type Profile } from '@/types'
import { containsPhrase } from './preferences'
import { FORBIDDEN_COPY, entry, food, localTime, planCopy, planInput, profile, recommendedFoods, systemFood } from './__fixtures__/adaptive'
import { netCarbsPer100g } from './diets'
import { buildAdaptivePlan } from './engine'
import type { AdaptivePlan } from './types'

function planFor(overrides: Partial<Profile>, now = localTime(12, 30)): AdaptivePlan {
  return buildAdaptivePlan(planInput({ profile: profile(overrides), now }))
}

describe('allergies', () => {
  it('never suggests foods with an allergen, unknown allergen data, or wheat for a gluten allergy', () => {
    const special = food({ name: 'House salad bowl', allergens: null, per100g: { calories: 140, protein: 12, carbs: 12, fat: 5, fiber: 5 } })
    const foods = [...SYSTEM_FOODS, special]
    const free = buildAdaptivePlan(planInput({ foods, favoriteFoodIds: [special.id], profile: profile() }))
    expect(recommendedFoods(free).map((item) => item.id)).toContain(special.id)

    const plan = buildAdaptivePlan(planInput({ foods, favoriteFoodIds: [special.id], profile: profile({ allergies: ['milk', 'gluten'] }) }))
    expect(plan.status).toBe('ok')
    for (const item of recommendedFoods(plan)) {
      expect(item.allergens).not.toBeNull()
      expect(item.allergens).not.toEqual(expect.arrayContaining(['milk']))
      expect(item.allergens).not.toEqual(expect.arrayContaining(['gluten']))
      expect(item.allergens).not.toEqual(expect.arrayContaining(['wheat']))
    }
  })
})

describe('diet patterns', () => {
  it('vegetarian and vegan plans only use explicitly compatible foods', () => {
    const vegetarian = planFor({ dietType: 'vegetarian' })
    const vegan = planFor({ dietType: 'vegan' })
    expect(vegetarian.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(vegan.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(recommendedFoods(vegetarian).every((item) => item.dietFlags.vegetarian === true)).toBe(true)
    expect(recommendedFoods(vegan).every((item) => item.dietFlags.vegan === true)).toBe(true)
  })

  it('keto plans use lower-carbohydrate foods', () => {
    const plan = planFor({ dietType: 'keto' }, localTime(18, 0))
    expect(plan.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(recommendedFoods(plan).every((item) => (netCarbsPer100g(item) ?? 99) <= 10)).toBe(true)
  })

  it('combines a restrictive diet with allergies', () => {
    const plan = planFor({ dietType: 'vegan', allergies: ['soy', 'sesame'] }, localTime(18, 0))
    expect(plan.status).toBe('ok')
    for (const item of recommendedFoods(plan)) {
      expect(item.dietFlags.vegan).toBe(true)
      expect(item.allergens ?? ['unknown']).not.toEqual(expect.arrayContaining(['soy']))
      expect(item.allergens ?? ['unknown']).not.toEqual(expect.arrayContaining(['sesame']))
    }
  })

  it('suggests reviewing preferences when a combination leaves nothing to suggest', () => {
    const plan = planFor({ dietType: 'vegan', allergies: ['soy', 'sesame'], maxPrepMinutes: 0 }, localTime(18, 0))
    expect(plan.status).toBe('no_candidates')
    expect(plan.message).toContain('reviewing allergies, dislikes, diet or prep time')
  })
})

describe('dislikes, meal slots and preparation', () => {
  it('leaves out disliked foods by name, tag or category', () => {
    const plan = planFor({ dislikes: ['egg', 'Pizza', 'fish', 'hummus'] })
    for (const item of recommendedFoods(plan)) {
      const text = [item.name, item.category ?? '', ...item.tags].join(' ')
      for (const dislike of ['egg', 'pizza', 'hummus']) expect(containsPhrase(text, dislike)).toBe(false)
      expect(item.allergens).not.toContain('fish')
    }
  })

  it('only suggests foods suited to the meal being planned', () => {
    const breakfastOnly = food({ name: 'Breakfast porridge', mealTypes: ['breakfast'], per100g: { calories: 120, protein: 15, carbs: 12, fat: 2 } })
    const plan = buildAdaptivePlan(planInput({ foods: [...SYSTEM_FOODS, breakfastOnly], favoriteFoodIds: [breakfastOnly.id] }))
    expect(recommendedFoods(plan).map((item) => item.id)).not.toContain(breakfastOnly.id)
    for (const item of recommendedFoods(plan)) expect(item.mealTypes.length === 0 || item.mealTypes.includes('lunch')).toBe(true)
  })

  it('respects the preferred preparation time', () => {
    const plan = planFor({ maxPrepMinutes: 10 })
    expect(plan.recommendations.length).toBeGreaterThanOrEqual(3)
    for (const rec of plan.recommendations) expect(rec.prepMinutes).toBeLessThanOrEqual(10)
  })

  it('keeps beginner cooks to 20 minutes and leads with quick ideas', () => {
    const plan = planFor({ cookingSkill: 'beginner', maxPrepMinutes: 60 })
    for (const rec of plan.recommendations) expect(rec.prepMinutes).toBeLessThanOrEqual(20)
    const confident = planFor({ cookingSkill: 'confident', maxPrepMinutes: 60 })
    expect(Math.max(...confident.recommendations.map((rec) => rec.prepMinutes))).toBeGreaterThan(20)
  })

  it('lifts favorites', () => {
    const lentils = systemFood('lentils_cooked')
    const base = buildAdaptivePlan(planInput())
    const favored = buildAdaptivePlan(planInput({ favoriteFoodIds: [lentils.id] }))
    const share = (plan: AdaptivePlan) => recommendedFoods(plan).filter((item) => item.id === lentils.id).length
    expect(share(favored)).toBeGreaterThanOrEqual(share(base))
    expect(favored.recommendations.find((rec) => rec.items.some((item) => item.food.id === lentils.id))?.breakdown.preference).toBeGreaterThan(0.02)
  })
})

describe('vocabulary guard', () => {
  it('keeps every generated message, title and explanation neutral and one sentence long', () => {
    const pizza = systemFood('cheese_pizza')
    const days = [[], [entry(pizza, 900, 'breakfast'), entry(pizza, 700, 'lunch')], [entry(systemFood('white_bread'), 120, 'breakfast')]]
    const sentences: string[] = []
    for (const dietType of DIET_TYPES) {
      for (const hour of [7, 12, 18, 22, 23.75]) {
        for (const entries of days) {
          for (const variant of [0, 1]) {
            const now = localTime(Math.floor(hour), (hour % 1) * 60)
            sentences.push(...planCopy(buildAdaptivePlan(planInput({ profile: profile({ dietType }), entries, now, variant }))))
          }
        }
      }
    }
    sentences.push(...planCopy(buildAdaptivePlan(planInput({ date: '2026-10-01' }))), ...planCopy(buildAdaptivePlan(planInput({ foods: [] }))))
    expect(sentences.length).toBeGreaterThan(500)
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(FORBIDDEN_COPY)
      expect(sentence.trim().length).toBeGreaterThan(0)
    }
    const explanations = sentences.filter((sentence) => sentence.startsWith('A ') || sentence.startsWith('High in'))
    for (const explanation of explanations) expect(explanation).toMatch(/^[^.]+\.$/)
  })
})
