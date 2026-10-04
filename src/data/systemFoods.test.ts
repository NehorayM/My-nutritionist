import { describe, expect, it } from 'vitest'
import { SYSTEM_FOOD_RECORDS, SYSTEM_FOOD_ROWS, toFoodRow, usdaAttribution, type SystemFoodRow } from '@/data/catalog'
import {
  SYSTEM_FOODS,
  SYSTEM_FOODS_RELEASED_AT,
  isSystemFoodId,
  systemFoodById,
  systemFoodBySlug,
  systemFoodProvenance,
  toSystemFoodItem,
} from '@/data/systemFoods'

function firstRow(): SystemFoodRow {
  const row = SYSTEM_FOOD_ROWS[0]
  if (!row) throw new Error('catalog is empty')
  return row
}

describe('SYSTEM_FOODS', () => {
  it('exposes every catalog record as a system FoodItem', () => {
    expect(SYSTEM_FOODS).toHaveLength(SYSTEM_FOOD_RECORDS.length)
    SYSTEM_FOODS.forEach((food, index) => {
      const record = SYSTEM_FOOD_RECORDS[index]
      expect(food.id).toBe(record?.id)
      expect(food.externalId).toBe(record?.slug)
      expect(food.source).toBe('system')
      expect(food.brand).toBeNull()
      expect(food.barcode).toBeNull()
      expect(food.createdBy).toBeNull()
      expect(food.createdAt).toBe(SYSTEM_FOODS_RELEASED_AT)
      expect(food.updatedAt).toBe(SYSTEM_FOODS_RELEASED_AT)
    })
  })

  it('carries the original values: per-100 g nutrients, servings, flags and practicality', () => {
    const chicken = systemFoodBySlug('chicken_breast_roasted')
    expect(chicken?.name).toBe('Chicken breast, roasted (skinless)')
    expect(chicken?.category).toBe('protein')
    expect(chicken?.per100g.calories).toBe(165)
    expect(chicken?.per100g.protein).toBe(31)
    expect(chicken?.servings[0]).toEqual({ label: '1/2 breast (86 g)', grams: 86 })
    expect(chicken?.dietFlags).toEqual({ vegetarian: false, vegan: false })
    expect(chicken?.allergens).toEqual([])
    expect(chicken?.mealTypes).toEqual(['lunch', 'dinner'])
    expect(chicken?.requiresCooking).toBe(true)
    expect(chicken?.costTier).toBe(2)
  })

  it('keeps unknown allergen information as null', () => {
    expect(systemFoodBySlug('protein_bar')?.allergens).toBeNull()
  })

  it('cites the USDA dataset and FDC id in the attribution', () => {
    expect(systemFoodBySlug('chicken_breast_roasted')?.attribution).toBe('USDA FoodData Central · SR Legacy #171477')
    expect(systemFoodBySlug('hummus')?.attribution).toBe('USDA FoodData Central · FNDDS #2707402')
    expect(usdaAttribution({ dataType: 'foundation', fdcId: 2259796 })).toBe('USDA FoodData Central · Foundation #2259796')
    for (const food of SYSTEM_FOODS) {
      expect(food.attribution).toMatch(/^USDA FoodData Central · (SR Legacy|FNDDS|Foundation) #\d+$/)
    }
  })

  it('is immutable so shared catalog data cannot be changed by accident', () => {
    const food = SYSTEM_FOODS[0]
    if (!food) throw new Error('catalog is empty')
    expect(Object.isFrozen(SYSTEM_FOODS)).toBe(true)
    expect(() => {
      food.name = 'Renamed'
    }).toThrow(TypeError)
    expect(() => {
      food.per100g.calories = 1
    }).toThrow(TypeError)
    expect(() => food.tags.push('extra')).toThrow(TypeError)
    expect(() => {
      const serving = food.servings[0]
      if (serving) serving.grams = 1
    }).toThrow(TypeError)
  })
})

describe('lookups', () => {
  it('finds foods by id (case-insensitive) and by slug', () => {
    const banana = systemFoodBySlug('banana')
    expect(banana).toBeDefined()
    expect(systemFoodById(banana?.id ?? '')).toBe(banana)
    expect(systemFoodById((banana?.id ?? '').toUpperCase())).toBe(banana)
    expect(isSystemFoodId(banana?.id ?? '')).toBe(true)
  })

  it('returns undefined for unknown ids and slugs', () => {
    expect(systemFoodById('00000000-0000-4000-8000-000000000000')).toBeUndefined()
    expect(systemFoodBySlug('dragon_fruit_souffle')).toBeUndefined()
    expect(isSystemFoodId('not-an-id')).toBe(false)
    expect(systemFoodProvenance('not-an-id')).toBeUndefined()
  })

  it('returns full USDA provenance for proxies', () => {
    const shakshuka = systemFoodBySlug('shakshuka')
    const provenance = systemFoodProvenance(shakshuka?.id ?? '')
    expect(provenance).toMatchObject({ fdcId: 2707191, dataType: 'survey_fndds', match: 'proxy' })
    expect(provenance?.description).toBe('Huevos rancheros')
    expect(provenance?.note).toMatch(/No shakshuka record/)
  })
})

describe('toSystemFoodItem', () => {
  it('rejects values outside the shared enumerations with a descriptive error', () => {
    const row = firstRow()
    expect(() => toSystemFoodItem({ ...row, category: 'dessert' })).toThrow(
      `System food "${row.externalId}" has an unsupported category "dessert"`,
    )
    expect(() => toSystemFoodItem({ ...row, allergens: ['celery'] })).toThrow(/unsupported allergen "celery"/)
    expect(() => toSystemFoodItem({ ...row, mealTypes: ['brunch'] })).toThrow(/unsupported meal type "brunch"/)
  })

  it('copies row data instead of sharing references', () => {
    const record = SYSTEM_FOOD_RECORDS[0]
    if (!record) throw new Error('catalog is empty')
    const row = toFoodRow(record, '2026-01-01T00:00:00.000Z')
    const food = toSystemFoodItem(row)
    expect(food.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(food.servings).toEqual(record.servings)
    expect(food.servings).not.toBe(row.servings)
    expect(food.per100g).not.toBe(record.per100g)
    expect(Object.isFrozen(record.per100g)).toBe(false)
  })
})
