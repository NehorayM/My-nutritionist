import { describe, expect, it } from 'vitest'
import {
  normalizeUsdaFood,
  normalizeUsdaSearchResponse,
  type UsdaFoodDto,
} from '../../../../supabase/functions/_shared/usda/normalize.ts'
import fullFoods from '../__fixtures__/usda-food-full.json'
import brandedSearch from '../__fixtures__/usda-search-branded.json'
import genericSearch from '../__fixtures__/usda-search-generic.json'

function fullFood(fdcId: number): UsdaFoodDto {
  const raw = (fullFoods as unknown[]).find((food) => (food as { fdcId: number }).fdcId === fdcId)
  const food = normalizeUsdaFood(raw)
  if (food === null) throw new Error(`fixture ${fdcId} did not normalize`)
  return food
}

describe('normalizeUsdaSearchResponse (generic scope sample)', () => {
  const response = normalizeUsdaSearchResponse(genericSearch, { page: 1, pageSize: 6 })

  it('echoes paging and keeps upstream totals', () => {
    expect(response).not.toBeNull()
    expect(response?.page).toBe(1)
    expect(response?.pageSize).toBe(6)
    expect(response?.totalHits).toBe(1089)
    expect(response?.totalPages).toBe(182)
    expect(response?.foods.map((food) => food.externalId)).toEqual(['2705709', '328637'])
  })

  it('maps a Survey (FNDDS) search item with UPPERCASE units and foodMeasures', () => {
    const survey = response?.foods[0]
    expect(survey).toMatchObject({
      name: 'Cheese, Cheddar',
      brand: null,
      barcode: null,
      dataType: 'survey_fndds',
      attribution: 'USDA FoodData Central · Survey (FNDDS) #2705709',
    })
    expect(survey?.per100g).toEqual({
      calories: 409,
      protein: 23.3,
      carbs: 2.44,
      fat: 34,
      fiber: 0,
      sugars: 0.33,
      saturatedFat: 19.2,
      sodium: 654,
      potassium: 77,
      calcium: 707,
      iron: 0.16,
      vitaminC: 0,
      vitaminD: 0.6,
    })
    // Ordered by rank; "Quantity not specified" is dropped.
    expect(survey?.servings.slice(0, 3)).toEqual([
      { label: '1 cracker-size slice', grams: 9 },
      { label: '1 slice', grams: 21 },
      { label: '1 stick', grams: 28.35 },
    ])
    expect(survey?.servings.some((s) => /not specified/i.test(s.label))).toBe(false)
    expect(survey?.servings).toHaveLength(9)
  })

  it('uses fallback nutrient ids and keeps absent nutrients unknown (null, never 0)', () => {
    const foundation = response?.foods[1]
    expect(foundation?.dataType).toBe('foundation')
    expect(foundation?.per100g.sugars).toBe(0.33) // only 1063 "Sugars, Total" present
    expect(foundation?.per100g.fat).toBe(34) // 1004 wins over 1085
    expect(foundation?.per100g.fiber).toBeNull()
    expect(foundation?.per100g.vitaminC).toBeNull()
    expect(foundation?.per100g.vitaminD).toBeNull()
    expect(foundation?.servings).toEqual([])
  })
})

describe('normalizeUsdaSearchResponse (branded sample)', () => {
  const response = normalizeUsdaSearchResponse(brandedSearch, { page: 2, pageSize: 3 })

  it('title-cases shouting descriptions and brands, keeps the GTIN and label serving', () => {
    const [first] = response?.foods ?? []
    expect(response?.page).toBe(2)
    expect(first).toMatchObject({
      externalId: '2057648',
      name: 'Cheddar Cheese',
      brand: 'Grafton Village',
      barcode: '094395000172',
      dataType: 'branded',
      servings: [{ label: '1 oz (28 g)', grams: 28 }],
      attribution: 'USDA FoodData Central · Branded #2057648',
    })
    expect(first?.per100g.potassium).toBeNull()
    expect(first?.per100g.iron).toBe(0)
  })
})

describe('normalizeUsdaFood (format=full sample)', () => {
  it('prefers Atwater specific energy (2048) when 1008 is absent', () => {
    const apple = fullFood(1750339)
    expect(apple.per100g.calories).toBe(55.6227)
    expect(apple.per100g.carbs).toBe(14.7817) // by difference wins over by summation
    expect(apple.servings).toEqual([{ label: '1 typical serving', grams: 140 }])
  })

  it('builds SR Legacy portion labels in USDA sequence order and prefers µg vitamin D over IU', () => {
    const cheddar = fullFood(173414)
    expect(cheddar.dataType).toBe('sr_legacy')
    expect(cheddar.per100g.vitaminD).toBe(0.6)
    expect(cheddar.per100g.saturatedFat).toBe(18.867)
    expect(cheddar.servings.map((s) => s.label)).toEqual([
      '1 cup, diced',
      '1 cup, melted',
      '1 cup, shredded',
      '1 oz',
      '1 cubic inch',
      '1 slice (1 oz)',
    ])
    expect(cheddar.attribution).toBe('USDA FoodData Central · SR Legacy #173414')
  })

  it('builds Foundation portion labels from amount + measure unit + description', () => {
    const cheddar = fullFood(328637)
    expect(cheddar.servings).toEqual([
      { label: '1 slice', grams: 17 },
      { label: '1 typical serving', grams: 30 },
      { label: '1 cup, shredded', grams: 105 },
    ])
    expect(cheddar.per100g.calories).toBe(408)
  })

  it('uses Survey portionDescription and ignores numeric modifier codes', () => {
    const survey = fullFood(2705709)
    expect(survey.servings[0]).toEqual({ label: '1 cracker-size slice', grams: 9 })
    expect(survey.servings.every((s) => !/\d{4,}/.test(s.label))).toBe(true)
  })

  it('keeps household text that already states grams and keeps reported zeros', () => {
    const branded = fullFood(2602108)
    expect(branded.servings).toEqual([{ label: '1 slice (21g)', grams: 21 }])
    expect(branded.brand).toBe('Natural & Kosher')
    expect(branded.barcode).toBe('0651219201179')
    expect(branded.per100g.vitaminD).toBe(0)
    expect(branded.per100g.potassium).toBe(0)
    expect(branded.per100g.vitaminC).toBeNull()
  })
})
