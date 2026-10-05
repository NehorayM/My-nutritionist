import { describe, expect, it } from 'vitest'
import { systemFoodBySlug } from '@/data/systemFoods'
import { nutrientProfile } from '@/domain/nutrients'
import type { FoodItem, FoodPortion } from '@/types'
import { canFavorite, foodFromPortion, kcalPer100gText } from './foods'

const apple = systemFoodBySlug('apple') as FoodItem

function portion(overrides: Partial<FoodPortion>): FoodPortion {
  return {
    foodId: null,
    foodSource: 'custom',
    foodExternalId: null,
    foodName: 'Mom’s cake',
    brand: null,
    quantity: 1,
    servingLabel: '1 slice',
    servingGrams: 80,
    grams: 80,
    per100g: nutrientProfile({ calories: 350 }),
    ...overrides,
  }
}

describe('food helpers', () => {
  it('formats energy per 100 g, unknown as —', () => {
    expect(kcalPer100gText(apple)).toBe('52 kcal / 100 g')
    expect(kcalPer100gText({ per100g: nutrientProfile({}) })).toBe('— / 100 g')
  })

  it('resolves a logged portion to the catalog food, or rebuilds a read-only food from its snapshot', () => {
    expect(foodFromPortion(portion({ foodId: apple.id, foodSource: 'system' }), [])).toBe(apple)
    const rebuilt = foodFromPortion(portion({}), [])
    expect(rebuilt).toMatchObject({ name: 'Mom’s cake', servings: [{ label: '1 slice', grams: 80 }], source: 'custom' })
    expect(canFavorite(rebuilt, [])).toBe(false)
  })

  it('allows favorites for catalog foods, provider results and the user’s own foods', () => {
    expect(canFavorite(apple, [])).toBe(true)
    const provider = foodFromPortion(portion({ foodSource: 'usda', foodExternalId: '42' }), [])
    expect(provider.createdBy).toBeNull()
    expect(canFavorite(provider, [])).toBe(true)
    const own: FoodItem = { ...apple, id: '1c1c1c1c-0000-4000-8000-000000000001', source: 'custom', createdBy: 'me' }
    expect(canFavorite(own, [own])).toBe(true)
    expect(canFavorite(own, [])).toBe(false)
  })
})
