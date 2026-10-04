import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS } from '@/types'
import {
  FDC_NUTRIENT_NUMBERS,
  USDA_NUTRIENT_KEYS,
  fdcDataTypesForScope,
  normalizeUsdaFood,
  normalizeUsdaFoodResponse,
  normalizeUsdaSearchResponse,
} from '../../../../supabase/functions/_shared/usda/normalize.ts'

type Row = Record<string, unknown>

const searchRow = (nutrientId: number, unitName: string, value: number): Row => ({ nutrientId, unitName, value })
const fullRow = (id: number, unitName: string, amount?: number): Row => ({ nutrient: { id, unitName }, amount })

function food(overrides: Row = {}, foodNutrients: Row[] = [searchRow(1008, 'KCAL', 100)]): Row {
  return { fdcId: 123, dataType: 'SR Legacy', description: 'Test food', foodNutrients, ...overrides }
}

describe('shared USDA contract constants', () => {
  it('mirrors the app nutrient keys exactly', () => {
    expect([...USDA_NUTRIENT_KEYS]).toEqual([...NUTRIENT_KEYS])
  })

  it('requests at most 25 unique nutrient numbers (upstream limit)', () => {
    expect(FDC_NUTRIENT_NUMBERS.length).toBeLessThanOrEqual(25)
    expect(new Set(FDC_NUTRIENT_NUMBERS).size).toBe(FDC_NUTRIENT_NUMBERS.length)
    expect(FDC_NUTRIENT_NUMBERS).toContain('208')
    expect(FDC_NUTRIENT_NUMBERS).toContain('324')
  })

  it('maps scopes to FDC data types', () => {
    expect(fdcDataTypesForScope('generic')).toEqual(['Foundation', 'SR Legacy', 'Survey (FNDDS)'])
    expect(fdcDataTypesForScope('branded')).toEqual(['Branded'])
  })
})

describe('normalizeUsdaFood unit conversions', () => {
  it('converts energy reported only in kJ to kcal', () => {
    const result = normalizeUsdaFood(food({}, [fullRow(1062, 'kJ', 1000)]))
    expect(result?.per100g.calories).toBe(239.0057)
  })

  it('converts vitamin D reported only in IU to µg (÷ 40)', () => {
    const result = normalizeUsdaFood(food({}, [searchRow(1008, 'KCAL', 50), searchRow(1110, 'IU', 400)]))
    expect(result?.per100g.vitaminD).toBe(10)
  })

  it('converts mass units to the target unit (µg sodium → mg, mg protein → g)', () => {
    const result = normalizeUsdaFood(
      food({}, [searchRow(1008, 'KCAL', 50), searchRow(1093, 'UG', 2500), searchRow(1003, 'MG', 1500)]),
    )
    expect(result?.per100g.sodium).toBe(2.5)
    expect(result?.per100g.protein).toBe(1.5)
  })

  it('reads abridged rows that only carry a nutrient number', () => {
    const result = normalizeUsdaFood(
      food({}, [
        { number: '208', amount: 52, unitName: 'KCAL' },
        { number: '303', amount: 0.12, unitName: 'MG' },
        { number: '328', amount: 1.1, unitName: 'UG' },
      ]),
    )
    expect(result?.per100g).toMatchObject({ calories: 52, iron: 0.12, vitaminD: 1.1, protein: null })
  })

  it('skips group header rows without an amount and rows with unknown units', () => {
    const result = normalizeUsdaFood(
      food({}, [fullRow(1003, 'g'), fullRow(1004, 'PERCENT', 12), fullRow(1008, 'kcal', 80)]),
    )
    expect(result?.per100g.protein).toBeNull()
    expect(result?.per100g.fat).toBeNull()
    expect(result?.per100g.calories).toBe(80)
  })

  it('treats physically impossible values as unknown and falls back to the next candidate', () => {
    const result = normalizeUsdaFood(
      food({}, [searchRow(1008, 'KCAL', 2228), searchRow(2047, 'KCAL', 530), searchRow(1003, 'G', 140)]),
    )
    expect(result?.per100g.calories).toBe(530)
    expect(result?.per100g.protein).toBeNull()
  })

  it('ignores negative amounts', () => {
    const result = normalizeUsdaFood(food({}, [searchRow(1008, 'KCAL', 90), searchRow(1079, 'G', -1)]))
    expect(result?.per100g.fiber).toBeNull()
  })
})

describe('normalizeUsdaFood rejection rules', () => {
  it.each([
    ['not an object', 'cheese'],
    ['missing description', food({ description: '   ' })],
    ['invalid fdcId', food({ fdcId: -4 })],
    ['unsupported data type', food({ dataType: 'Experimental' })],
    ['no calories/protein/carbs/fat', food({}, [searchRow(1093, 'MG', 300)])],
  ])('drops items with %s', (_label, raw) => {
    expect(normalizeUsdaFood(raw)).toBeNull()
  })

  it('wraps a usable detail in the food action body and returns null otherwise', () => {
    expect(normalizeUsdaFoodResponse(food())?.food.externalId).toBe('123')
    expect(normalizeUsdaFoodResponse(food({ dataType: 'Experimental' }))).toBeNull()
  })

  it('returns null for a malformed search envelope and drops unusable items', () => {
    expect(normalizeUsdaSearchResponse({ totalHits: 3 }, { page: 1, pageSize: 5 })).toBeNull()
    const response = normalizeUsdaSearchResponse(
      { totalHits: 'n/a', foods: [food(), food({ description: null }), 'junk'] },
      { page: 1, pageSize: 5 },
    )
    expect(response?.foods).toHaveLength(1)
    expect(response?.totalHits).toBe(0)
    expect(response?.totalPages).toBe(0)
  })
})

describe('normalizeUsdaFood names, brands and barcodes', () => {
  it('title-cases shouting text but keeps small words and numbers lowercase', () => {
    const result = normalizeUsdaFood(food({ description: 'BEANS AND RICE WITH 2% MILK' }))
    expect(result?.name).toBe('Beans and Rice with 2% Milk')
  })

  it('truncates names to 200 characters', () => {
    const result = normalizeUsdaFood(food({ description: 'x'.repeat(250) }))
    expect(result?.name).toHaveLength(200)
    expect(result?.name.endsWith('…')).toBe(true)
  })

  it('only keeps brand and barcode for Branded foods; falls back to brandOwner', () => {
    const branded = normalizeUsdaFood(food({ dataType: 'Branded', brandOwner: 'Acme Foods, Inc.', gtinUpc: '12345' }))
    expect(branded?.brand).toBe('Acme Foods, Inc.')
    expect(branded?.barcode).toBeNull() // 5 digits is not a valid GTIN
    const generic = normalizeUsdaFood(food({ brandOwner: 'Acme', gtinUpc: '0041711093004' }))
    expect(generic?.brand).toBeNull()
    expect(generic?.barcode).toBeNull()
  })
})

describe('normalizeUsdaFood servings', () => {
  it('labels a branded serving without household text', () => {
    const result = normalizeUsdaFood(food({ dataType: 'Branded', servingSize: 30, servingSizeUnit: 'GRM' }))
    expect(result?.servings).toEqual([{ label: '1 serving (30 g)', grams: 30 }])
  })

  it('accepts ml servings for branded liquids and skips unknown units', () => {
    const liquid = normalizeUsdaFood(
      food({ dataType: 'Branded', servingSize: 240, servingSizeUnit: 'MLT', householdServingFullText: '1 CUP' }),
    )
    expect(liquid?.servings).toEqual([{ label: '1 cup (240 ml)', grams: 240 }])
    const ounces = normalizeUsdaFood(food({ dataType: 'Branded', servingSize: 1, servingSizeUnit: 'oz' }))
    expect(ounces?.servings).toEqual([])
  })

  it('drops invalid portions, de-duplicates labels and caps the list at 20', () => {
    const portions = [
      { gramWeight: 0, amount: 1, modifier: 'slice' },
      { gramWeight: 10, amount: 1, measureUnit: { name: 'undetermined' } },
      ...Array.from({ length: 30 }, (_, i) => ({ gramWeight: 5 + i, amount: i + 1, modifier: 'piece', sequenceNumber: i })),
      { gramWeight: 50, amount: 1, modifier: 'piece', sequenceNumber: 0 },
    ]
    const result = normalizeUsdaFood(food({ foodPortions: portions }))
    expect(result?.servings).toHaveLength(20)
    expect(result?.servings[0]).toEqual({ label: '1 piece', grams: 5 })
    expect(result?.servings.filter((s) => s.label === '1 piece')).toHaveLength(1)
  })
})
