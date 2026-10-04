import { describe, expect, it } from 'vitest'
import cheerios from '../__fixtures__/off-product-cheerios.json'
import nutella from '../__fixtures__/off-product-nutella.json'
import hummusSearch from '../__fixtures__/off-search-hummus.json'
import israelSearch from '../__fixtures__/off-search-israel.json'
import { mapOffProduct, offProductToDraft } from './off'
import { offProductSchema, type OffProduct } from './offSchema'

const parse = (raw: unknown): OffProduct => offProductSchema.parse(raw)
const israel = (index: number): OffProduct => parse(israelSearch.products[index])
const hummus = (index: number): OffProduct => parse(hummusSearch.products[index])

describe('mapOffProduct with real Open Food Facts products', () => {
  it('maps Nutella: kcal, grams→mg sodium, reported zeros, no serving info', () => {
    const draft = offProductToDraft(parse(nutella.product))
    expect(draft).toMatchObject({
      source: 'off',
      externalId: '3017624010701',
      barcode: '3017624010701',
      name: 'Nutella',
      brand: 'Ferrero',
      attribution: 'Open Food Facts (ODbL) · 3017624010701',
      allergens: ['tree_nuts'],
      dietFlags: { vegetarian: null, vegan: null },
      servings: [],
      createdBy: null,
    })
    expect(draft?.per100g).toEqual({
      calories: 539,
      protein: 6.3,
      carbs: 57.5,
      fat: 30.9,
      fiber: null,
      sugars: 56.3,
      saturatedFat: 10.6,
      sodium: 43,
      potassium: null,
      calcium: null,
      iron: null,
      vitaminC: null,
      vitaminD: null,
    })
  })

  it('maps Cheerios: serving from serving_quantity, dirty allergen tags ignored', () => {
    const draft = offProductToDraft(parse(cheerios.product))
    expect(draft?.servings).toEqual([{ label: '39g', grams: 39 }])
    expect(draft?.allergens).toEqual(['gluten'])
    expect(draft?.per100g.calories).toBe(358.9744)
    expect(draft?.per100g.sodium).toBe(487.1795)
    expect(draft?.per100g.fiber).toBe(10.2564)
    expect(draft?.barcode).toBe('0016000275287')
  })

  it('converts minerals and vitamins reported in grams (Tnuva milk)', () => {
    const draft = offProductToDraft(israel(0))
    expect(draft?.name).toBe('חלב טרי 3%')
    expect(draft?.brand).toBe('תנובה')
    expect(draft?.per100g).toMatchObject({
      calories: 60,
      calcium: 100,
      iron: 0.031,
      potassium: 164.379,
      vitaminC: 1.361,
      vitaminD: 0.079,
      sodium: 50,
    })
    expect(draft?.servings).toEqual([{ label: '1 serving (100 g)', grams: 100 }])
    expect(draft?.allergens).toEqual(['milk'])
    expect(draft?.dietFlags).toEqual({ vegetarian: true, vegan: false })
  })

  it('rejects products without any core nutrient (mineral water)', () => {
    const result = mapOffProduct(israel(1))
    expect(result).toEqual({ ok: false, reason: 'missing_nutrition', code: '7290019056942', name: 'מים מינרליים' })
  })

  it('keeps allergens unknown when the tag list is empty and ingredients were never analyzed', () => {
    const coffee = offProductToDraft(israel(2))
    expect(coffee?.allergens).toBeNull()
    expect(coffee?.per100g.sodium).toBe(0)
    expect(coffee?.servings).toEqual([{ label: '2g', grams: 2 }])
  })

  it('maps vegan labels and the first brand of a comma-separated list', () => {
    const draft = offProductToDraft(hummus(0))
    expect(draft?.brand).toBe('Hacendado')
    expect(draft?.dietFlags).toEqual({ vegetarian: true, vegan: true })
    expect(draft?.allergens).toEqual(['sesame'])
    expect(draft?.servings).toEqual([{ label: '1 portion (50 g)', grams: 50 }])
  })

  it('maps non-vegetarian analysis to false for both flags', () => {
    const draft = offProductToDraft(hummus(2))
    expect(draft?.dietFlags).toEqual({ vegetarian: false, vegan: false })
    expect(draft?.allergens).toEqual(['milk', 'sesame'])
    expect(draft?.servings).toEqual([])
  })
})
