import { describe, expect, it } from 'vitest'
import { mapOffProduct, offProductToDraft, offServings } from './off'
import { mapOffNutriments } from './offNutrients'
import { offProductSchema, type OffProduct } from './offSchema'
import { mapOffAllergens, mapOffDietFlags } from './offTags'

function product(overrides: Record<string, unknown> = {}): OffProduct {
  return offProductSchema.parse({
    code: '7290000000015',
    product_name: 'Test bar',
    nutriments: { 'energy-kcal_100g': 400 },
    ...overrides,
  })
}

describe('mapOffNutriments unit handling', () => {
  it('converts kJ-only energy to kcal and never reads energy_100g as kcal', () => {
    expect(mapOffNutriments({ 'energy-kj_100g': 1000 }).calories).toBe(239.0057)
    expect(mapOffNutriments({ energy_100g: 418.4 }).calories).toBe(100)
  })

  it('derives sodium from salt only when sodium is missing (salt ÷ 2.5 → mg)', () => {
    expect(mapOffNutriments({ salt_100g: 1.25 }).sodium).toBe(500)
    expect(mapOffNutriments({ salt_100g: 1.25, sodium_100g: 0.4 }).sodium).toBe(400)
  })

  it('converts grams to mg and µg', () => {
    const profile = mapOffNutriments({ 'iron_100g': 0.0021, 'vitamin-d_100g': 2.5e-6, 'calcium_100g': '0.12' })
    expect(profile).toMatchObject({ iron: 2.1, vitaminD: 2.5, calcium: 120 })
  })

  it('treats an approximate zero as unknown but keeps label zeros and approximate non-zeros', () => {
    const profile = mapOffNutriments({
      fiber_100g: 0,
      fiber_modifier: '~',
      sugars_100g: 0,
      proteins_100g: 3,
      proteins_modifier: '~',
    })
    expect(profile.fiber).toBeNull()
    expect(profile.sugars).toBe(0)
    expect(profile.protein).toBe(3)
  })

  it('prefers the explicit total carbohydrate when present', () => {
    expect(mapOffNutriments({ carbohydrates_100g: 50, 'carbohydrates-total_100g': 56 }).carbs).toBe(56)
    expect(mapOffNutriments({ carbohydrates_100g: 50 }).carbs).toBe(50)
  })

  it('maps impossible or malformed values to unknown', () => {
    const profile = mapOffNutriments({
      'energy-kcal_100g': 2228,
      fat_100g: 130,
      proteins_100g: -2,
      sugars_100g: 'n/a',
      fiber_100g: '',
    })
    expect(profile).toMatchObject({ calories: null, fat: null, protein: null, sugars: null, fiber: null })
  })

  it('returns an all-unknown profile without nutriments', () => {
    expect(Object.values(mapOffNutriments(null)).every((value) => value === null)).toBe(true)
  })
})

describe('mapOffProduct rejection and identity rules', () => {
  it('rejects products flagged as having no nutrition data', () => {
    expect(mapOffProduct(product({ no_nutrition_data: 'on' }))).toMatchObject({ ok: false, reason: 'missing_nutrition' })
  })

  it('rejects products without a usable name, falling back to the English name first', () => {
    expect(mapOffProduct(product({ product_name: '  ' }))).toMatchObject({ ok: false, reason: 'missing_name' })
    expect(offProductToDraft(product({ product_name: '', product_name_en: 'Granola bar' }))?.name).toBe('Granola bar')
  })

  it('rejects invalid codes and normalizes numeric / short codes like OFF', () => {
    expect(mapOffProduct(product({ code: 'abc' }))).toMatchObject({ ok: false, reason: 'invalid_code' })
    expect(mapOffProduct(product({ code: null }))).toMatchObject({ ok: false, reason: 'invalid_code' })
    expect(offProductToDraft(product({ code: 16000275287 }))?.externalId).toBe('0016000275287')
  })

  it('truncates long names and brands to the database limits', () => {
    const draft = offProductToDraft(product({ product_name: 'n'.repeat(260), brands: ['b'.repeat(150), 'Other'] }))
    expect(draft?.name).toHaveLength(200)
    expect(draft?.brand).toHaveLength(120)
  })
})

describe('offServings', () => {
  it('appends the amount when the label does not state it', () => {
    expect(offServings(product({ serving_size: '1 cup', serving_quantity: '30' }))).toEqual([
      { label: '1 cup (30 g)', grams: 30 },
    ])
  })

  it('does not confuse digits inside another number with the serving amount', () => {
    expect(offServings(product({ serving_size: '1 bottle (250 ml)', serving_quantity: 5 }))).toEqual([
      { label: '1 bottle (250 ml) (5 g)', grams: 5 },
    ])
  })

  it('keeps ml servings and creates a label when serving_size is missing', () => {
    expect(offServings(product({ serving_quantity: 330, serving_quantity_unit: 'ml' }))).toEqual([
      { label: '1 serving (330 ml)', grams: 330 },
    ])
  })

  it.each([
    ['missing quantity', { serving_size: '1 bar' }],
    ['zero quantity', { serving_quantity: 0 }],
    ['implausible quantity', { serving_quantity: 24000 }],
    ['unsupported unit', { serving_quantity: 1, serving_quantity_unit: 'oz' }],
  ])('returns no serving for %s', (_label, overrides) => {
    expect(offServings(product(overrides))).toEqual([])
  })
})

describe('mapOffAllergens', () => {
  it('returns null when allergen tags are absent', () => {
    expect(mapOffAllergens({})).toBeNull()
  })

  it('returns [] for an empty list when the ingredients were analyzed', () => {
    expect(mapOffAllergens({ allergens_tags: [], ingredients_analysis_tags: ['en:palm-oil-free'] })).toEqual([])
  })

  it('includes traces, explicit wheat and de-duplicates shellfish groups', () => {
    expect(
      mapOffAllergens({
        allergens_tags: ['en:crustaceans', 'en:molluscs', 'en:wheat', 'en:mustard'],
        traces_tags: ['en:peanuts', 'en:soybeans', 'en:fish', 'en:eggs'],
      }),
    ).toEqual(['egg', 'fish', 'peanuts', 'shellfish', 'soy', 'wheat'])
  })
})

describe('mapOffDietFlags', () => {
  it('keeps maybe/unknown statuses as null', () => {
    expect(mapOffDietFlags({ ingredients_analysis_tags: ['en:maybe-vegan', 'en:maybe-vegetarian'] })).toEqual({
      vegetarian: null,
      vegan: null,
    })
  })

  it('lets the manufacturer label win over a conflicting analysis', () => {
    expect(
      mapOffDietFlags({ labels_tags: ['en:vegan'], ingredients_analysis_tags: ['en:non-vegan', 'en:non-vegetarian'] }),
    ).toEqual({ vegetarian: true, vegan: true })
  })

  it('derives vegetarian-but-not-vegan from analysis', () => {
    expect(mapOffDietFlags({ ingredients_analysis_tags: ['en:non-vegan', 'en:vegetarian'] })).toEqual({
      vegetarian: true,
      vegan: false,
    })
    expect(mapOffDietFlags({ labels_tags: ['en:vegetarian'] })).toEqual({ vegetarian: true, vegan: null })
  })
})
